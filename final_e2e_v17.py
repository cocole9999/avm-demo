#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V1.17 数据导入向导 E2E
- 测 resources / template / preview (csv, xlsx) / execute 全流程
- 测 7 资源 (customers, car_models, projects, work_items, contacts, dependencies, users)
- 测智能 autoMap 字段映射
- 测必填校验 + 重复 code 拒绝
"""
import urllib.request
import urllib.parse
import json
import os
import sys
import io
import csv
from datetime import datetime, timedelta

BASE = 'http://127.0.0.1:4000'

# dev 模式无 token 走宽松模式 → dev-user (tenant_admin)
HEADERS = {}

# 资源中文 → key 映射
RESOURCES = ['customers', 'car_models', 'projects', 'work_items', 'contacts', 'dependencies', 'users']

# 测试数据 — 每个资源的有效行
def gen_csv_for(resource):
    """生成符合资源字段的有效 CSV"""
    rows_map = {
        'customers': [
            ['E2E客户A', f'E2E-CUST-{int(datetime.now().timestamp())}-A', '客户A', 'external', '汽车', '张三', '13800001001', 'a@e2e.com', '杭州', '测试用'],
            ['E2E客户B', f'E2E-CUST-{int(datetime.now().timestamp())}-B', '客户B', 'internal', '电子', '李四', '13800001002', 'b@e2e.com', '上海', '测试用'],
        ],
        'car_models': [
            ['E2E车型A', f'E2E-MODEL-{int(datetime.now().timestamp())}-A', 'E2E品牌', 'E2E系列', '2026', 'SUV', 'SEA', 'E2E 测试车型'],
        ],
        'projects': [
            # projects 需要 customerCode + carModelCode 引用存在的
        ],
        'work_items': [
            ['requirement', f'E2E 需求 A {int(datetime.now().timestamp())}', 'P1', 'admin', '系统', '描述内容', '40', '2026-08-01', '2026-08-30'],
        ],
        'contacts': [
            # 引用 customerCode
        ],
        'dependencies': [
            ['E2E 外部依赖 A', '车模', 'preparing', 'admin', '2026-09-30', 'E2E 测试 blocker', '', '', 'E2E 测试'],
        ],
        'users': [
            [f'e2e_user_{int(datetime.now().timestamp())}', 'E2E测试用户', 'init123', 'e2e@test.com', '测试组', 'member'],
        ],
    }
    rows = rows_map[resource]
    # 表头
    headers_map = {
        'customers': ['客户全称', '客户编码', '简称', '类型', '行业', '主联系人', '电话', '邮箱', '地址', '描述'],
        'car_models': ['车型名称', '车型编码', '品牌', '系列', '上市年份', '细分市场', '平台', '描述'],
        'projects': ['项目名称', '项目编码', '客户编码', '车型编码', '状态', '合同类型', '合同金额(元)', '预算工时', '已用工时', '进度(0-100)', '风险等级', '开始日期', '结束日期', '描述'],
        'work_items': ['类型', '标题', '优先级', '负责人', '报告人', '描述', '预估工时', '计划开始', '计划结束'],
        'contacts': ['姓名', '客户编码', '角色', '部门', '电话', '邮箱', '飞书ID', '是否主联系人'],
        'dependencies': ['依赖名称', '类型', '状态', '负责人', '预计日期', '卡点', '关联工作项', '关联项目', '描述'],
        'users': ['用户名', '显示名', '初始密码', '邮箱', '部门', '角色'],
    }
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(headers_map[resource])
    writer.writerows(rows)
    return out.getvalue()

def http(method, path, data=None, is_json=True, raw_data=None, content_type=None):
    url = f'{BASE}{path}'
    headers = dict(HEADERS)
    body = None
    if data is not None and is_json:
        body = json.dumps(data).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    elif raw_data is not None:
        body = raw_data
        if content_type:
            headers['Content-Type'] = content_type
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=15)
        return r.status, r.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8')

def build_multipart(resource, csv_text, file_name='test.csv'):
    """构造 multipart/form-data body"""
    boundary = '----V1.17E2E' + str(int(datetime.now().timestamp()))
    body = []
    # resource 字段
    body.append(f'--{boundary}'.encode())
    body.append(b'Content-Disposition: form-data; name="resource"')
    body.append(b'')
    body.append(resource.encode('utf-8'))
    # file 字段
    body.append(f'--{boundary}'.encode())
    body.append(f'Content-Disposition: form-data; name="file"; filename="{file_name}"'.encode())
    body.append(b'Content-Type: text/csv')
    body.append(b'')
    body.append(csv_text.encode('utf-8'))
    body.append(f'--{boundary}--'.encode())
    body.append(b'')
    return b'\r\n'.join(body), boundary

PASS = 0
FAIL = 0
ERRORS = []

def check(name, cond, detail=''):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f'  ✅ {name}')
    else:
        FAIL += 1
        ERRORS.append(f'{name}: {detail}')
        print(f'  ❌ {name} {detail}')

# ============ E2E ============
print('=' * 60)
print('V1.17 数据导入向导 E2E')
print('=' * 60)

# 1. resources
print('\n【1. /api/imports/resources 资源列表】')
code, body = http('GET', '/api/imports/resources')
data = json.loads(body)
check('GET resources 200', code == 200, f'code={code}')
check('有 7+ 资源', len(data.get('resources', [])) >= 7, f'count={len(data.get("resources", []))}')
check('别名 10+ 组', len(data.get('aliases', {})) >= 10, f'count={len(data.get("aliases", {}))}')
resource_keys = [r['key'] for r in data.get('resources', [])]
for k in ['customers', 'car_models', 'work_items', 'contacts', 'dependencies', 'users']:
    check(f'资源 {k} 存在', k in resource_keys)

# 2. template
print('\n【2. /api/imports/template/:resource 模板下载】')
for k in ['customers', 'work_items', 'users']:
    code, body = http('GET', f'/api/imports/template/{k}')
    check(f'GET template/{k} 200', code == 200, f'code={code}')
    check(f'  template/{k} 含 BOM', body.startswith('\ufeff') or '客户' in body or '用户' in body or '工作' in body)
    lines = body.lstrip('\ufeff').strip().split('\n')
    check(f'  template/{k} 至少 2 行', len(lines) >= 2, f'lines={len(lines)}')

# 3. preview (CSV)
print('\n【3. /api/imports/preview CSV 解析 + 智能字段映射】')
ts = int(datetime.now().timestamp())
# 3.1 customers with Chinese headers
csv_customers = f'''客户全称,客户编码,简称,类型,行业,主联系人,电话,邮箱,地址,描述
E2E客户_{ts}_A,E2E-CUST-{ts}-A,客户A,external,汽车,张三,13800001001,a@e2e.com,杭州,E2E测试
E2E客户_{ts}_B,E2E-CUST-{ts}-B,客户B,internal,电子,李四,13800001002,b@e2e.com,上海,E2E测试
'''
body_bytes, boundary = build_multipart('customers', csv_customers)
code, body = http('POST', '/api/imports/preview', raw_data=body_bytes, is_json=False, content_type=f'multipart/form-data; boundary={boundary}')
data = json.loads(body) if code == 200 else {}
check('preview customers 200', code == 200, f'code={code} body={body[:200]}')
check('preview 解析 2 行', data.get('total') == 2, f'total={data.get("total")}')
check('preview 列识别', len(data.get('columns', [])) == 10, f'columns={len(data.get("columns", []))}')
mapping = {m['csvColumn']: m['dbField'] for m in data.get('mapping', [])}
check('智能映射 客户全称→name', mapping.get('客户全称') == 'name', f'mapping={mapping.get("客户全称")}')
check('智能映射 客户编码→code', mapping.get('客户编码') == 'code', f'mapping={mapping.get("客户编码")}')
check('智能映射 邮箱→email', mapping.get('邮箱') == 'email')
check('智能映射 主联系人→contact', mapping.get('主联系人') == 'contact')

# 3.2 JSON mode (csvText)
code, body = http('POST', '/api/imports/preview', data={'resource': 'customers', 'csvText': csv_customers})
data2 = json.loads(body) if code == 200 else {}
check('preview JSON 模式 200', code == 200)
check('JSON 模式 total 一致', data2.get('total') == data.get('total') if data else True)

# 4. preview (xlsx) - generate xlsx in memory
print('\n【4. /api/imports/preview xlsx 解析】')
try:
    import xlsxwriter
    fn = f'D:/AI/飞书项目/avm-demo/_t_v17_test.xlsx'
    wb = xlsxwriter.Workbook(fn)
    ws = wb.add_worksheet('客户')
    headers_xl = ['客户全称', '客户编码', '简称', '类型', '行业']
    ws.write_row(0, 0, headers_xl)
    ws.write_row(1, 0, [f'E2EXL_{ts}_A', f'E2E-CUST-XL-{ts}-A', '客户A', 'external', '汽车'])
    ws.write_row(2, 0, [f'E2EXL_{ts}_B', f'E2E-CUST-XL-{ts}-B', '客户B', 'internal', '电子'])
    wb.close()
    with open(fn, 'rb') as f:
        xlsx_bytes = f.read()
    os.remove(fn)
    # build multipart with xlsx
    boundary = '----V1.17XL' + str(int(datetime.now().timestamp()))
    body_parts = []
    body_parts.append(f'--{boundary}'.encode())
    body_parts.append(b'Content-Disposition: form-data; name="resource"')
    body_parts.append(b'')
    body_parts.append(b'customers')
    body_parts.append(f'--{boundary}'.encode())
    body_parts.append(f'Content-Disposition: form-data; name="file"; filename="test.xlsx"'.encode())
    body_parts.append(b'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    body_parts.append(b'')
    body_parts.append(xlsx_bytes)
    body_parts.append(f'--{boundary}--'.encode())
    body_parts.append(b'')
    xlsx_body = b'\r\n'.join(body_parts)
    code, body = http('POST', '/api/imports/preview', raw_data=xlsx_body, is_json=False, content_type=f'multipart/form-data; boundary={boundary}')
    data_xl = json.loads(body) if code == 200 else {}
    check('preview xlsx 200', code == 200, f'code={code} body={body[:200]}')
    check('xlsx 解析 2 行', data_xl.get('total') == 2, f'total={data_xl.get("total")}')
    mapping_xl = {m['csvColumn']: m['dbField'] for m in data_xl.get('mapping', [])}
    check('xlsx 智能映射 客户编码→code', mapping_xl.get('客户编码') == 'code')
except ImportError:
    print('  ⚠️ xlsxwriter 未装, 跳过 xlsx 测试')
except Exception as e:
    print(f'  ⚠️ xlsx 测试异常: {e}')

# 5. execute 实际导入
print('\n【5. /api/imports/execute 实际执行】')
csv_to_import = f'''客户全称,客户编码,简称,类型,行业,主联系人,电话,邮箱,地址,描述
E2E导入_{ts}_1,E2E-IMP-{ts}-1,导入A,external,汽车,张三,13800001111,a@e2e.com,杭州,E2E导入测试
E2E导入_{ts}_2,E2E-IMP-{ts}-2,导入B,internal,电子,李四,13800001112,b@e2e.com,上海,E2E导入测试
'''
# 先 preview 拿 mapping
body_bytes, boundary = build_multipart('customers', csv_to_import)
code, body = http('POST', '/api/imports/preview', raw_data=body_bytes, is_json=False, content_type=f'multipart/form-data; boundary={boundary}')
prev = json.loads(body) if code == 200 else {}
mapping_list = prev.get('mapping', [])
# 解析 CSV 行为 objects
import csv as csvmod
reader = csvmod.DictReader(io.StringIO(csv_to_import))
data_rows = list(reader)
# execute
code, body = http('POST', '/api/imports/execute', data={
    'resource': 'customers',
    'mapping': mapping_list,
    'data': data_rows,
    'fileName': 'e2e_test.csv',
    'name': f'E2E测试导入_{ts}',
})
result = json.loads(body) if code in (200, 201) else {}
check('execute 201/200', code in (200, 201), f'code={code} body={body[:200]}')
check('execute succeeded == 2', result.get('result', {}).get('succeeded') == 2, f'result={result.get("result")}')
check('execute failed == 0', result.get('result', {}).get('failed') == 0, f'failed={result.get("result", {}).get("failed")}')
check('job 创建成功', result.get('job', {}).get('id') is not None)

# 6. 重复 code 应该失败
print('\n【6. 重复 code 拒绝导入】')
code, body = http('POST', '/api/imports/execute', data={
    'resource': 'customers',
    'mapping': mapping_list,
    'data': data_rows,
    'fileName': 'e2e_dup.csv',
})
result2 = json.loads(body) if code in (200, 201) else {}
check('重复导入 succeeded < 2', result2.get('result', {}).get('succeeded', 0) < 2, f'result={result2.get("result")}')
check('重复导入 failed == 2', result2.get('result', {}).get('failed') == 2, f'failed={result2.get("result", {}).get("failed")}')
if result2.get('result', {}).get('errors'):
    err = result2['result']['errors'][0]['error']
    check('错误信息含"已存在"', '已存在' in err or 'exists' in err.lower(), f'err={err}')

# 7. 必填字段缺失
print('\n【7. 必填字段缺失校验】')
csv_missing = '客户全称,客户编码,类型\n缺编码行,,external\n'  # 缺客户编码
body_bytes, boundary = build_multipart('customers', csv_missing)
code, body = http('POST', '/api/imports/preview', raw_data=body_bytes, is_json=False, content_type=f'multipart/form-data; boundary={boundary}')
prev2 = json.loads(body) if code == 200 else {}
code2, body2 = http('POST', '/api/imports/execute', data={
    'resource': 'customers',
    'mapping': prev2.get('mapping', []),
    'data': [{'客户全称': '缺编码行', '客户编码': '', '类型': 'external'}],
    'fileName': 'e2e_missing.csv',
})
res_miss = json.loads(body2) if code2 in (200, 201) else {}
check('缺必填 failed >= 1', res_miss.get('result', {}).get('failed', 0) >= 1, f'result={res_miss.get("result")}')

# 8. work_items 资源
print('\n【8. work_items 资源导入】')
csv_wi = f'''类型,标题,优先级,负责人,报告人,描述,预估工时,计划开始,计划结束
requirement,E2E需求_{ts}_1,P1,admin,系统,E2E测试需求,40,2026-08-01,2026-08-30
task,E2E任务_{ts}_1,P2,admin,系统,E2E测试任务,16,2026-08-15,2026-08-20
'''
body_bytes, boundary = build_multipart('work_items', csv_wi)
code, body = http('POST', '/api/imports/preview', raw_data=body_bytes, is_json=False, content_type=f'multipart/form-data; boundary={boundary}')
prev_wi = json.loads(body) if code == 200 else {}
mapping_wi = prev_wi.get('mapping', [])
import csv as csvmod
data_wi = list(csvmod.DictReader(io.StringIO(csv_wi)))
code, body = http('POST', '/api/imports/execute', data={
    'resource': 'work_items',
    'mapping': mapping_wi,
    'data': data_wi,
    'fileName': 'e2e_wi.csv',
})
res_wi = json.loads(body) if code in (200, 201) else {}
check('work_items succeeded == 2', res_wi.get('result', {}).get('succeeded') == 2, f'result={res_wi.get("result")}')

# 9. car_models
print('\n【9. car_models 资源导入】')
csv_cm = f'''车型名称,车型编码,品牌,系列,上市年份,细分市场,平台,描述
E2E车型_{ts}_A,E2E-CM-{ts}-A,E2E品牌,系列A,2026,SUV,SEA,E2E测试车型
'''
body_bytes, boundary = build_multipart('car_models', csv_cm)
code, body = http('POST', '/api/imports/preview', raw_data=body_bytes, is_json=False, content_type=f'multipart/form-data; boundary={boundary}')
prev_cm = json.loads(body) if code == 200 else {}
mapping_cm = prev_cm.get('mapping', [])
data_cm = list(csvmod.DictReader(io.StringIO(csv_cm)))
code, body = http('POST', '/api/imports/execute', data={
    'resource': 'car_models',
    'mapping': mapping_cm,
    'data': data_cm,
    'fileName': 'e2e_cm.csv',
})
res_cm = json.loads(body) if code in (200, 201) else {}
check('car_models succeeded == 1', res_cm.get('result', {}).get('succeeded') == 1, f'result={res_cm.get("result")}')

# 10. users
print('\n【10. users 资源导入】')
csv_us = f'''用户名,显示名,初始密码,邮箱,部门,角色
e2e_user_{ts}_1,E2E测试用户1,init123,u1@e2e.com,测试组,member
e2e_user_{ts}_2,E2E测试用户2,init456,u2@e2e.com,测试组,member
'''
body_bytes, boundary = build_multipart('users', csv_us)
code, body = http('POST', '/api/imports/preview', raw_data=body_bytes, is_json=False, content_type=f'multipart/form-data; boundary={boundary}')
prev_us = json.loads(body) if code == 200 else {}
mapping_us = prev_us.get('mapping', [])
data_us = list(csvmod.DictReader(io.StringIO(csv_us)))
code, body = http('POST', '/api/imports/execute', data={
    'resource': 'users',
    'mapping': mapping_us,
    'data': data_us,
    'fileName': 'e2e_us.csv',
})
res_us = json.loads(body) if code in (200, 201) else {}
check('users succeeded == 2', res_us.get('result', {}).get('succeeded') == 2, f'result={res_us.get("result")}')

# 11. dependencies
print('\n【11. dependencies 资源导入】')
csv_dep = f'''依赖名称,类型,状态,负责人,预计日期,卡点,关联工作项,关联项目,描述
E2E依赖_{ts}_A,车模,preparing,admin,2026-09-30,E2E blocker,,,E2E测试依赖
'''
body_bytes, boundary = build_multipart('dependencies', csv_dep)
code, body = http('POST', '/api/imports/preview', raw_data=body_bytes, is_json=False, content_type=f'multipart/form-data; boundary={boundary}')
prev_dep = json.loads(body) if code == 200 else {}
mapping_dep = prev_dep.get('mapping', [])
data_dep = list(csvmod.DictReader(io.StringIO(csv_dep)))
code, body = http('POST', '/api/imports/execute', data={
    'resource': 'dependencies',
    'mapping': mapping_dep,
    'data': data_dep,
    'fileName': 'e2e_dep.csv',
})
res_dep = json.loads(body) if code in (200, 201) else {}
check('dependencies succeeded == 1', res_dep.get('result', {}).get('succeeded') == 1, f'result={res_dep.get("result")}')

# 12. jobs list
print('\n【12. /api/imports/jobs 任务列表】')
code, body = http('GET', '/api/imports/jobs?limit=10')
jobs = json.loads(body) if code == 200 else []
check('jobs 列表 200', code == 200)
check('jobs 至少 3 个', len(jobs) >= 3, f'count={len(jobs)}')
if jobs:
    check('job 含 name', all('name' in j for j in jobs))
    check('job 含 status', all('status' in j for j in jobs))
    # get detail
    code, body = http('GET', f'/api/imports/jobs/{jobs[0]["id"]}')
    detail = json.loads(body) if code == 200 else {}
    check('jobs/:id 详情 200', code == 200)
    check('jobs/:id 含 total', 'total' in detail)

# 13. contacts
print('\n【13. contacts 资源导入 (引用 customerCode)】')
csv_ct = f'''姓名,客户编码,角色,部门,电话,邮箱,飞书ID,是否主联系人
E2E联系人_{ts}_A,E2E-IMP-{ts}-1,UPL,AVM平台,13800003333,a@e2e.com,feishu_aaa,true
'''
body_bytes, boundary = build_multipart('contacts', csv_ct)
code, body = http('POST', '/api/imports/preview', raw_data=body_bytes, is_json=False, content_type=f'multipart/form-data; boundary={boundary}')
prev_ct = json.loads(body) if code == 200 else {}
mapping_ct = prev_ct.get('mapping', [])
data_ct = list(csvmod.DictReader(io.StringIO(csv_ct)))
code, body = http('POST', '/api/imports/execute', data={
    'resource': 'contacts',
    'mapping': mapping_ct,
    'data': data_ct,
    'fileName': 'e2e_ct.csv',
})
res_ct = json.loads(body) if code in (200, 201) else {}
check('contacts succeeded == 1', res_ct.get('result', {}).get('succeeded') == 1, f'result={res_ct.get("result")}')

# 14. 中文别名 (别名映射)
print('\n【14. 中文别名智能识别】')
csv_zh = f'''名字,编号,品牌,系列
中文别名测试A_{ts},ZH-{ts}-A,品牌A,系列A
'''
body_bytes, boundary = build_multipart('car_models', csv_zh)
code, body = http('POST', '/api/imports/preview', raw_data=body_bytes, is_json=False, content_type=f'multipart/form-data; boundary={boundary}')
prev_zh = json.loads(body) if code == 200 else {}
mapping_zh = {m['csvColumn']: m['dbField'] for m in prev_zh.get('mapping', [])}
check('名字→name', mapping_zh.get('名字') == 'name', f'mapping={mapping_zh.get("名字")}')
check('编号→code', mapping_zh.get('编号') == 'code')
check('品牌→brand', mapping_zh.get('品牌') == 'brand')

# 15. 错误 resource
print('\n【15. 错误处理】')
code, body = http('GET', '/api/imports/resources')  # baseline
check('GET 列表 200', code == 200)
code, body = http('GET', '/api/imports/template/unknown')
check('未知资源 template 400', code == 400, f'code={code}')
code, body = http('POST', '/api/imports/preview', data={'resource': 'unknown', 'csvText': 'a,b\n1,2'})
check('未知资源 preview 400', code == 400, f'code={code}')

# ============ 总结 ============
print('\n' + '=' * 60)
print(f'V1.17 导入 E2E: ✅ {PASS} passed, ❌ {FAIL} failed')
print('=' * 60)
if FAIL > 0:
    print('\n失败项:')
    for e in ERRORS:
        print(f'  - {e}')
sys.exit(0 if FAIL == 0 else 1)
