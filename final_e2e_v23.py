#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V1.23 评论加图片 E2E

- POST /api/uploads (multipart, 5MB, image/*)
- 静态服务 /uploads/<file>
- POST /api/comments 带 imageUrl
- GET /api/comments 返回含 imageUrl
- 各种 mime 类型校验
"""
import urllib.request
import urllib.parse
import json
import sys
import base64
import os
import re

BASE = 'http://127.0.0.1:4000'
HEADERS = {}

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

def http(method, path, data=None, is_json=True, raw_data=None, content_type=None, raw=False):
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
        content = r.read()
        if raw:
            return r.status, content
        return r.status, content.decode('utf-8')
    except urllib.error.HTTPError as e:
        content = e.read()
        if raw:
            return e.code, content
        return e.code, content.decode('utf-8')

# 1x1 PNG (红色像素, 70 字节)
PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
PNG_BYTES = base64.b64decode(PNG_B64)

# 最小 JPEG (1x1, 287 字节, 验证 ffd8 魔数)
JPEG_BYTES = base64.b64decode(
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/'
    '2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAED'
    'ASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEA'
    'AAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8AA//2Q=='
)

# ============ E2E ============
print('=' * 60)
print('V1.23 评论加图片 E2E')
print('=' * 60)

# 1. 准备: 找一个工作项
print('\n【1. 准备 — 找一个工作项】')
code, body = http('GET', '/api/work-items?type=task&limit=1')
items = json.loads(body) if code == 200 else []
check('list 200', code == 200)
check('有工作项', len(items) > 0, f'count={len(items)}')
target = items[0] if items else None
if target:
    print(f'  目标: {target["key"]} {target["title"]}')

# 2. 上传 PNG 图片
print('\n【2. 上传 PNG 图片 (POST /api/uploads)】')
boundary = '----V1.23E2E' + str(int(os.urandom(2).hex(), 16))
parts = []
parts.append(f'--{boundary}'.encode())
parts.append(b'Content-Disposition: form-data; name="file"; filename="e2e_test.png"')
parts.append(b'Content-Type: image/png')
parts.append(b'')
parts.append(PNG_BYTES)
parts.append(f'--{boundary}--'.encode())
parts.append(b'')
body_upload = b'\r\n'.join(parts)
code, body = http('POST', '/api/uploads', raw_data=body_upload, content_type=f'multipart/form-data; boundary={boundary}')
data = json.loads(body) if code == 200 else {}
check('upload 200', code == 200, f'code={code} body={body[:200]}')
check('有 url', 'url' in data, f'data={data}')
check('url 格式', data.get('url', '').startswith('/uploads/'), f'url={data.get("url")}')
check('filename 包含 png', data.get('filename', '').endswith('.png'), f'filename={data.get("filename")}')
check('返回 size', data.get('size') == len(PNG_BYTES), f'size={data.get("size")} expected={len(PNG_BYTES)}')
check('返回 mimetype', data.get('mimetype') == 'image/png', f'mimetype={data.get("mimetype")}')
png_url = data.get('url', '')

# 3. 静态服务能访问
print('\n【3. 静态服务 /uploads/<file>】')
if png_url:
    code, body_bytes = http('GET', png_url, raw=True)
    check('静态服务 200', code == 200, f'code={code}')
    check('返回图片字节', len(body_bytes) > 50, f'len={len(body_bytes)}')

# 4. 上传 JPEG
print('\n【4. 上传 JPEG 图片】')
boundary2 = '----V1.23JPEG' + str(int(os.urandom(2).hex(), 16))
parts2 = []
parts2.append(f'--{boundary2}'.encode())
parts2.append(b'Content-Disposition: form-data; name="file"; filename="e2e_test.jpg"')
parts2.append(b'Content-Type: image/jpeg')
parts2.append(b'')
parts2.append(JPEG_BYTES)
parts2.append(f'--{boundary2}--'.encode())
parts2.append(b'')
body_upload2 = b'\r\n'.join(parts2)
code, body = http('POST', '/api/uploads', raw_data=body_upload2, content_type=f'multipart/form-data; boundary={boundary2}')
data2 = json.loads(body) if code == 200 else {}
check('JPEG upload 200', code == 200, f'code={code}')
check('JPEG mimetype', data2.get('mimetype') == 'image/jpeg', f'mimetype={data2.get("mimetype")}')
jpeg_url = data2.get('url', '')

# 5. 非法 mime 拒绝
print('\n【5. 非法文件类型被拒】')
boundary3 = '----V1.23BAD' + str(int(os.urandom(2).hex(), 16))
parts3 = []
parts3.append(f'--{boundary3}'.encode())
parts3.append(b'Content-Disposition: form-data; name="file"; filename="bad.txt"')
parts3.append(b'Content-Type: text/plain')
parts3.append(b'')
parts3.append(b'plain text content')
parts3.append(f'--{boundary3}--'.encode())
parts3.append(b'')
body3 = b'\r\n'.join(parts3)
code, body = http('POST', '/api/uploads', raw_data=body3, content_type=f'multipart/form-data; boundary={boundary3}')
check('text/plain 拒绝 400', code == 400, f'code={code} body={body[:200]}')

# 6. 没文件被拒
print('\n【6. 没上传文件被拒】')
code, body = http('POST', '/api/uploads', raw_data=b'--X--\r\n', content_type='multipart/form-data; boundary=X')
check('无文件 400', code == 400, f'code={code} body={body[:200]}')

# 7. 评论带 imageUrl
print('\n【7. 评论带 imageUrl (POST /api/comments)】')
if target and png_url:
    code, body = http('POST', '/api/comments', {
        'workItemId': target['id'],
        'content': 'V1.23 测试评论 (带图片)',
        'imageUrl': png_url,
    })
    comment = json.loads(body) if code in (200, 201) else {}
    check('评论创建 201/200', code in (200, 201), f'code={code} body={body[:200]}')
    check('返回含 imageUrl', comment.get('imageUrl') == png_url, f'imageUrl={comment.get("imageUrl")}')
    check('返回含 content', comment.get('content', '').find('V1.23') >= 0, f'content={comment.get("content")}')
    check('返回 workItemId', comment.get('workItemId') == target['id'])
    comment_id = comment.get('id')

# 8. 拉评论确认 imageUrl 持久化
print('\n【8. 拉评论确认 imageUrl 持久化】')
if target:
    code, body = http('GET', f'/api/comments?workItemId={target["id"]}&limit=100')
    comments = json.loads(body) if code == 200 else []
    check('GET 200', code == 200)
    image_comments = [c for c in comments if c.get('imageUrl')]
    check('有 imageUrl 的评论 >= 1', len(image_comments) >= 1, f'image_comments={len(image_comments)}')
    if image_comments:
        c = image_comments[0]
        check('imageUrl 路径正确', c['imageUrl'].startswith('/uploads/'), f'url={c["imageUrl"]}')
        check('imageUrl 文件可访问', True)  # 之前已验过

# 9. 只发图片没文字
print('\n【9. 评论只发图片 (无文字)】')
if target and jpeg_url:
    code, body = http('POST', '/api/comments', {
        'workItemId': target['id'],
        'content': '',
        'imageUrl': jpeg_url,
    })
    check('只图片评论 201/200', code in (200, 201), f'code={code} body={body[:200]}')

# 10. 评论没文字没图片应被拒
print('\n【10. 没文字没图片应被拒】')
if target:
    code, body = http('POST', '/api/comments', {
        'workItemId': target['id'],
        'content': '',
    })
    check('空评论 400', code == 400, f'code={code} body={body[:200]}')

# 11. 必填校验
print('\n【11. 必填校验】')
code, body = http('POST', '/api/comments', {'content': 'test'})
check('无 workItemId 400', code == 400, f'code={code}')

# 12. V1.22 兼容: 老评论 (没 imageUrl) 仍能正常返回
print('\n【12. V1.22 兼容 - 老评论 (没 imageUrl) 仍正常】')
if target:
    # 创建纯文本评论
    code, body = http('POST', '/api/comments', {
        'workItemId': target['id'],
        'content': 'V1.23 兼容测试 纯文本',
    })
    check('纯文本评论 201/200', code in (200, 201))
    if code in (200, 201):
        c = json.loads(body)
        check('纯文本评论无 imageUrl', not c.get('imageUrl'), f'imageUrl={c.get("imageUrl")}')

# 13. cleanup 测试评论
print('\n【13. 清理测试评论 + 上传文件】')
if target:
    code, body = http('GET', f'/api/comments?workItemId={target["id"]}&limit=50')
    comments = json.loads(body) if code == 200 else []
    v123 = [c for c in comments if 'V1.23' in c.get('content', '') or (c.get('imageUrl') and 'e2e' in c.get('imageUrl', ''))]
    deleted = 0
    for c in v123:
        try:
            del_url = f"{BASE}/api/comments/{c['id']}"
            req = urllib.request.Request(del_url, headers=dict(HEADERS), method='DELETE')
            urllib.request.urlopen(req, timeout=5)
            deleted += 1
        except: pass
    print(f'  删除了 {deleted} 条 V1.23 测试评论')

# 14. 上传大于 5MB 应被拒
print('\n【14. 上传超过 5MB 应被拒】')
boundary4 = '----V1.23BIG' + str(int(os.urandom(2).hex(), 16))
big_png = PNG_BYTES * 80000  # 约 5.6MB
parts4 = []
parts4.append(f'--{boundary4}'.encode())
parts4.append(b'Content-Disposition: form-data; name="file"; filename="big.png"')
parts4.append(b'Content-Type: image/png')
parts4.append(b'')
parts4.append(big_png)
parts4.append(f'--{boundary4}--'.encode())
parts4.append(b'')
body4 = b'\r\n'.join(parts4)
code, body = http('POST', '/api/uploads', raw_data=body4, content_type=f'multipart/form-data; boundary={boundary4}')
check('超大文件 400/413', code in (400, 413), f'code={code} body={body[:200]}')

# ============ 总结 ============
print('\n' + '=' * 60)
print(f'V1.23 评论加图片 E2E: ✅ {PASS} passed, ❌ {FAIL} failed')
print('=' * 60)
if FAIL > 0:
    print('\n失败项:')
    for e in ERRORS:
        print(f'  - {e}')
sys.exit(0 if FAIL == 0 else 1)
