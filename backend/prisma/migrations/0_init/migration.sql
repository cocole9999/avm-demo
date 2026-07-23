-- CreateTable
CREATE TABLE "WorkItem" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'P2',
    "severity" TEXT,
    "estimate" DOUBLE PRECISION,
    "actualHours" DOUBLE PRECISION,
    "storyPoints" DOUBLE PRECISION,
    "planStart" TIMESTAMP(3),
    "planEnd" TIMESTAMP(3),
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "assignee" TEXT,
    "reporter" TEXT NOT NULL,
    "module" TEXT,
    "labels" TEXT NOT NULL DEFAULT '',
    "spaceId" TEXT,
    "iterationId" TEXT,
    "parentId" TEXT,
    "currentNodeId" TEXT,
    "projectId" TEXT,
    "carModelId" TEXT,
    "customerId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItemRelation" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkItemRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iteration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'planning',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "spaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Iteration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "reactions" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "meta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "actorRole" TEXT,
    "changes" TEXT,
    "meta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodeFlow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workType" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NodeFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlowNode" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL DEFAULT 'normal',
    "description" TEXT NOT NULL DEFAULT '',
    "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "statusValue" TEXT,
    "roles" TEXT NOT NULL DEFAULT '',
    "requiredFields" TEXT NOT NULL DEFAULT '',
    "entryRule" TEXT NOT NULL DEFAULT '',
    "exitRule" TEXT NOT NULL DEFAULT '',
    "slaHours" INTEGER,
    "dodItems" TEXT NOT NULL DEFAULT '',
    "reviewType" TEXT,
    "reviewRule" TEXT NOT NULL DEFAULT 'majority',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlowNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlowTransition" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    "condition" TEXT NOT NULL DEFAULT '',
    "label" TEXT NOT NULL DEFAULT '',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FlowTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "reviewType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "conclusion" TEXT,
    "summary" TEXT NOT NULL DEFAULT '',
    "initiator" TEXT NOT NULL,
    "finalizer" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewItem" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "itemType" TEXT NOT NULL DEFAULT 'score',
    "description" TEXT NOT NULL DEFAULT '',
    "score" INTEGER,
    "maxScore" INTEGER NOT NULL DEFAULT 5,
    "checked" BOOLEAN,
    "answer" TEXT,
    "comment" TEXT NOT NULL DEFAULT '',
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewParticipant" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'reviewer',
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "hasResponded" BOOLEAN NOT NULL DEFAULT false,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reviewType" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "items" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChartConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "chartType" TEXT NOT NULL,
    "dimensions" TEXT NOT NULL,
    "measures" TEXT NOT NULL,
    "filters" TEXT NOT NULL DEFAULT '[]',
    "options" TEXT NOT NULL DEFAULT '{}',
    "source" TEXT NOT NULL DEFAULT 'work_items',
    "scope" TEXT NOT NULL DEFAULT 'global',
    "dashboardId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChartConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dashboard" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "layout" TEXT NOT NULL DEFAULT '[]',
    "scope" TEXT NOT NULL DEFAULT 'custom',
    "target" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dashboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIFieldConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workType" TEXT NOT NULL,
    "targetField" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "prompt" TEXT NOT NULL DEFAULT '',
    "inputFields" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIFieldConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIRunLog" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "workItemId" TEXT,
    "input" TEXT NOT NULL DEFAULT '',
    "output" TEXT NOT NULL DEFAULT '',
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIRunLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT NOT NULL,
    "department" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "token" TEXT,
    "tenantId" TEXT,
    "feishuOpenId" TEXT,
    "feishuUnionId" TEXT,
    "dingtalkId" TEXT,
    "wechatworkId" TEXT,
    "ssoBound" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Space" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT 'project',
    "status" TEXT NOT NULL DEFAULT 'active',
    "ownerId" TEXT,
    "config" TEXT NOT NULL DEFAULT '{}',
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Space_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpaceMember" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL DEFAULT '',
    "logo" TEXT NOT NULL DEFAULT '',
    "industry" TEXT NOT NULL DEFAULT '',
    "scale" TEXT NOT NULL DEFAULT '',
    "contact" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "expireAt" TIMESTAMP(3),
    "maxUsers" INTEGER NOT NULL DEFAULT 100,
    "plan" TEXT NOT NULL DEFAULT 'standard',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SSOSetting" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "appId" TEXT NOT NULL DEFAULT '',
    "appSecret" TEXT NOT NULL DEFAULT '',
    "redirectUri" TEXT NOT NULL DEFAULT '',
    "corpId" TEXT NOT NULL DEFAULT '',
    "agentId" TEXT NOT NULL DEFAULT '',
    "config" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SSOSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SSOLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "userKey" TEXT NOT NULL,
    "userName" TEXT NOT NULL DEFAULT '',
    "action" TEXT NOT NULL,
    "ip" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMsg" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SSOLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LLMSettings" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL DEFAULT '',
    "apiKey" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "maxTokens" INTEGER NOT NULL DEFAULT 2048,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT NOT NULL DEFAULT '',
    "extra" TEXT NOT NULL DEFAULT '{}',
    "customModels" TEXT NOT NULL DEFAULT '[]',
    "currentModel" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LLMSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT,
    "recipientId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "resourceType" TEXT,
    "resourceId" TEXT,
    "link" TEXT NOT NULL DEFAULT '',
    "meta" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT,
    "userId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT 'star',
    "link" TEXT NOT NULL DEFAULT '',
    "folder" TEXT NOT NULL DEFAULT '默认',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceAllocation" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "workItemKey" TEXT NOT NULL,
    "workItemTitle" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "allocatedHours" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'develop',
    "status" TEXT NOT NULL DEFAULT 'planned',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkbenchConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "defaultSpaceId" TEXT,
    "layout" TEXT NOT NULL DEFAULT '[]',
    "readNotifIds" TEXT NOT NULL DEFAULT '[]',
    "preferences" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkbenchConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormulaField" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT,
    "workType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "formula" TEXT NOT NULL DEFAULT '',
    "outputType" TEXT NOT NULL DEFAULT 'number',
    "format" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "cachedValues" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormulaField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RollupField" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT,
    "workType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "childType" TEXT NOT NULL DEFAULT 'task',
    "sourceField" TEXT NOT NULL,
    "aggregation" TEXT NOT NULL DEFAULT 'sum',
    "outputType" TEXT NOT NULL DEFAULT 'number',
    "format" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cachedValues" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RollupField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItemTemplate" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT,
    "name" TEXT NOT NULL,
    "workType" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "defaultFields" TEXT NOT NULL DEFAULT '{}',
    "childItems" TEXT NOT NULL DEFAULT '[]',
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '通用',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkItemTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "trigger" TEXT NOT NULL,
    "conditions" TEXT NOT NULL DEFAULT '[]',
    "actions" TEXT NOT NULL,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "lastRunResult" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationLog" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "triggerContext" TEXT NOT NULL DEFAULT '{}',
    "conditionsResult" TEXT NOT NULL DEFAULT 'false',
    "actionsExecuted" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'success',
    "error" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookConfig" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT NOT NULL DEFAULT '',
    "headers" TEXT NOT NULL DEFAULT '{}',
    "secret" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "retryCount" INTEGER NOT NULL DEFAULT 3,
    "totalCalls" INTEGER NOT NULL DEFAULT 0,
    "successCalls" INTEGER NOT NULL DEFAULT 0,
    "failedCalls" INTEGER NOT NULL DEFAULT 0,
    "lastCallAt" TIMESTAMP(3),
    "lastCallStatus" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookLog" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "response" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'success',
    "statusCode" INTEGER NOT NULL DEFAULT 200,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT,
    "name" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mapping" TEXT NOT NULL DEFAULT '[]',
    "defaults" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "total" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "succeeded" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT NOT NULL DEFAULT '[]',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkHandover" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT,
    "fromUserId" TEXT NOT NULL,
    "fromUserName" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "toUserName" TEXT NOT NULL,
    "workItemIds" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'done',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkHandover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Baseline" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT,
    "iterationId" TEXT,
    "iterationName" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "snapshot" TEXT NOT NULL DEFAULT '[]',
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "totalEstimate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "baselineType" TEXT NOT NULL DEFAULT 'iteration',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Baseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceAnalysis" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "result" TEXT NOT NULL DEFAULT '{}',
    "riskCount" INTEGER NOT NULL DEFAULT 0,
    "healthScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCase" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "caseType" TEXT NOT NULL DEFAULT 'functional',
    "priority" TEXT NOT NULL DEFAULT 'P1',
    "module" TEXT NOT NULL DEFAULT '',
    "tags" TEXT NOT NULL DEFAULT '',
    "preconditions" TEXT NOT NULL DEFAULT '',
    "steps" TEXT NOT NULL DEFAULT '[]',
    "expectedResult" TEXT NOT NULL DEFAULT '',
    "workItemId" TEXT,
    "workItemKey" TEXT,
    "automated" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestPlan" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "iterationId" TEXT,
    "iterationName" TEXT,
    "workItemIds" TEXT NOT NULL DEFAULT '[]',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "ownerId" TEXT,
    "ownerName" TEXT,
    "participants" TEXT NOT NULL DEFAULT '[]',
    "totalCases" INTEGER NOT NULL DEFAULT 0,
    "passedCases" INTEGER NOT NULL DEFAULT 0,
    "failedCases" INTEGER NOT NULL DEFAULT 0,
    "blockedCases" INTEGER NOT NULL DEFAULT 0,
    "skippedCases" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestPlanCase" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "orderNum" INTEGER NOT NULL DEFAULT 0,
    "assignee" TEXT,
    "assigneeName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "actualResult" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestPlanCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestRun" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "runnerId" TEXT NOT NULL,
    "runnerName" TEXT NOT NULL,
    "caseIds" TEXT NOT NULL DEFAULT '[]',
    "passed" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "blocked" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'running',
    "notes" TEXT NOT NULL DEFAULT '',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "TestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCaseBug" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "bugId" TEXT NOT NULL,
    "bugKey" TEXT NOT NULL,
    "bugTitle" TEXT NOT NULL,
    "relationType" TEXT NOT NULL DEFAULT 'found_by',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestCaseBug_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'internal',
    "industry" TEXT NOT NULL DEFAULT '汽车主机厂',
    "contact" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarModel" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "series" TEXT NOT NULL DEFAULT '',
    "launchYear" INTEGER,
    "segment" TEXT NOT NULL DEFAULT '',
    "platform" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "department" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "feishuId" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "primary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "customerId" TEXT NOT NULL,
    "carModelId" TEXT NOT NULL,
    "pmUserId" TEXT,
    "pmUserName" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "billingType" TEXT NOT NULL DEFAULT 'ODC',
    "contractAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "budgetHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "consumedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "risk" TEXT NOT NULL DEFAULT 'low',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT,
    "spaceId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalDependency" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "owner" TEXT NOT NULL DEFAULT '',
    "expectedDate" TIMESTAMP(3),
    "actualDate" TIMESTAMP(3),
    "blocker" TEXT NOT NULL DEFAULT '',
    "workItemId" TEXT,
    "projectId" TEXT,
    "spaceId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIReport" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "llmModel" TEXT,
    "userFilter" TEXT,
    "projectCode" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkItem_key_key" ON "WorkItem"("key");

-- CreateIndex
CREATE INDEX "WorkItem_type_idx" ON "WorkItem"("type");

-- CreateIndex
CREATE INDEX "WorkItem_status_idx" ON "WorkItem"("status");

-- CreateIndex
CREATE INDEX "WorkItem_iterationId_idx" ON "WorkItem"("iterationId");

-- CreateIndex
CREATE INDEX "WorkItem_assignee_idx" ON "WorkItem"("assignee");

-- CreateIndex
CREATE INDEX "WorkItem_projectId_idx" ON "WorkItem"("projectId");

-- CreateIndex
CREATE INDEX "WorkItem_carModelId_idx" ON "WorkItem"("carModelId");

-- CreateIndex
CREATE INDEX "WorkItem_customerId_idx" ON "WorkItem"("customerId");

-- CreateIndex
CREATE INDEX "WorkItem_parentId_idx" ON "WorkItem"("parentId");

-- CreateIndex
CREATE INDEX "WorkItem_priority_idx" ON "WorkItem"("priority");

-- CreateIndex
CREATE INDEX "WorkItem_planStart_planEnd_idx" ON "WorkItem"("planStart", "planEnd");

-- CreateIndex
CREATE INDEX "WorkItem_projectId_planStart_idx" ON "WorkItem"("projectId", "planStart");

-- CreateIndex
CREATE UNIQUE INDEX "WorkItemRelation_fromId_toId_relationType_key" ON "WorkItemRelation"("fromId", "toId", "relationType");

-- CreateIndex
CREATE UNIQUE INDEX "Iteration_name_key" ON "Iteration"("name");

-- CreateIndex
CREATE INDEX "Comment_workItemId_idx" ON "Comment"("workItemId");

-- CreateIndex
CREATE INDEX "Activity_workItemId_idx" ON "Activity"("workItemId");

-- CreateIndex
CREATE INDEX "Activity_createdAt_idx" ON "Activity"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actor_idx" ON "AuditLog"("actor");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entity_createdAt_idx" ON "AuditLog"("entity", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NodeFlow_workType_isActive_key" ON "NodeFlow"("workType", "isActive");

-- CreateIndex
CREATE INDEX "FlowNode_flowId_idx" ON "FlowNode"("flowId");

-- CreateIndex
CREATE INDEX "FlowTransition_flowId_idx" ON "FlowTransition"("flowId");

-- CreateIndex
CREATE INDEX "Review_workItemId_idx" ON "Review"("workItemId");

-- CreateIndex
CREATE INDEX "Review_status_idx" ON "Review"("status");

-- CreateIndex
CREATE INDEX "ReviewItem_reviewId_idx" ON "ReviewItem"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewParticipant_reviewId_userId_key" ON "ReviewParticipant"("reviewId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewTemplate_name_key" ON "ReviewTemplate"("name");

-- CreateIndex
CREATE INDEX "ChartConfig_dashboardId_idx" ON "ChartConfig"("dashboardId");

-- CreateIndex
CREATE INDEX "AIRunLog_configId_idx" ON "AIRunLog"("configId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "User_feishuOpenId_idx" ON "User"("feishuOpenId");

-- CreateIndex
CREATE INDEX "User_feishuUnionId_idx" ON "User"("feishuUnionId");

-- CreateIndex
CREATE INDEX "User_token_idx" ON "User"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Space_name_key" ON "Space"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Space_code_key" ON "Space"("code");

-- CreateIndex
CREATE INDEX "SpaceMember_userId_idx" ON "SpaceMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SpaceMember_spaceId_userId_key" ON "SpaceMember"("spaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_code_key" ON "Tenant"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SSOSetting_tenantId_provider_key" ON "SSOSetting"("tenantId", "provider");

-- CreateIndex
CREATE INDEX "SSOLog_tenantId_createdAt_idx" ON "SSOLog"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LLMSettings_provider_key" ON "LLMSettings"("provider");

-- CreateIndex
CREATE INDEX "Notification_recipientId_read_idx" ON "Notification"("recipientId", "read");

-- CreateIndex
CREATE INDEX "Notification_recipientId_createdAt_idx" ON "Notification"("recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_spaceId_idx" ON "Notification"("spaceId");

-- CreateIndex
CREATE INDEX "Notification_recipientId_type_idx" ON "Notification"("recipientId", "type");

-- CreateIndex
CREATE INDEX "Favorite_userId_idx" ON "Favorite"("userId");

-- CreateIndex
CREATE INDEX "Favorite_spaceId_idx" ON "Favorite"("spaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_resourceType_resourceId_key" ON "Favorite"("userId", "resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "ResourceAllocation_userId_startDate_endDate_idx" ON "ResourceAllocation"("userId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "ResourceAllocation_workItemId_idx" ON "ResourceAllocation"("workItemId");

-- CreateIndex
CREATE INDEX "ResourceAllocation_spaceId_idx" ON "ResourceAllocation"("spaceId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkbenchConfig_userId_key" ON "WorkbenchConfig"("userId");

-- CreateIndex
CREATE INDEX "FormulaField_spaceId_workType_idx" ON "FormulaField"("spaceId", "workType");

-- CreateIndex
CREATE UNIQUE INDEX "FormulaField_spaceId_workType_fieldKey_key" ON "FormulaField"("spaceId", "workType", "fieldKey");

-- CreateIndex
CREATE INDEX "RollupField_spaceId_workType_idx" ON "RollupField"("spaceId", "workType");

-- CreateIndex
CREATE UNIQUE INDEX "RollupField_spaceId_workType_fieldKey_key" ON "RollupField"("spaceId", "workType", "fieldKey");

-- CreateIndex
CREATE INDEX "WorkItemTemplate_spaceId_workType_idx" ON "WorkItemTemplate"("spaceId", "workType");

-- CreateIndex
CREATE INDEX "WorkItemTemplate_category_idx" ON "WorkItemTemplate"("category");

-- CreateIndex
CREATE INDEX "AutomationRule_spaceId_enabled_idx" ON "AutomationRule"("spaceId", "enabled");

-- CreateIndex
CREATE INDEX "AutomationLog_ruleId_createdAt_idx" ON "AutomationLog"("ruleId", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookConfig_spaceId_enabled_idx" ON "WebhookConfig"("spaceId", "enabled");

-- CreateIndex
CREATE INDEX "WebhookLog_configId_createdAt_idx" ON "WebhookLog"("configId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportJob_spaceId_status_idx" ON "ImportJob"("spaceId", "status");

-- CreateIndex
CREATE INDEX "WorkHandover_spaceId_fromUserId_idx" ON "WorkHandover"("spaceId", "fromUserId");

-- CreateIndex
CREATE INDEX "WorkHandover_spaceId_toUserId_idx" ON "WorkHandover"("spaceId", "toUserId");

-- CreateIndex
CREATE INDEX "Baseline_spaceId_iterationId_idx" ON "Baseline"("spaceId", "iterationId");

-- CreateIndex
CREATE INDEX "Baseline_baselineType_idx" ON "Baseline"("baselineType");

-- CreateIndex
CREATE INDEX "ResourceAnalysis_spaceId_createdAt_idx" ON "ResourceAnalysis"("spaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TestCase_code_key" ON "TestCase"("code");

-- CreateIndex
CREATE INDEX "TestCase_spaceId_module_idx" ON "TestCase"("spaceId", "module");

-- CreateIndex
CREATE INDEX "TestCase_workItemId_idx" ON "TestCase"("workItemId");

-- CreateIndex
CREATE INDEX "TestCase_caseType_idx" ON "TestCase"("caseType");

-- CreateIndex
CREATE INDEX "TestCase_priority_idx" ON "TestCase"("priority");

-- CreateIndex
CREATE INDEX "TestPlan_spaceId_status_idx" ON "TestPlan"("spaceId", "status");

-- CreateIndex
CREATE INDEX "TestPlan_iterationId_idx" ON "TestPlan"("iterationId");

-- CreateIndex
CREATE INDEX "TestPlanCase_planId_status_idx" ON "TestPlanCase"("planId", "status");

-- CreateIndex
CREATE INDEX "TestPlanCase_assignee_status_idx" ON "TestPlanCase"("assignee", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TestPlanCase_planId_caseId_key" ON "TestPlanCase"("planId", "caseId");

-- CreateIndex
CREATE INDEX "TestRun_planId_status_idx" ON "TestRun"("planId", "status");

-- CreateIndex
CREATE INDEX "TestRun_runnerId_idx" ON "TestRun"("runnerId");

-- CreateIndex
CREATE INDEX "TestCaseBug_bugId_idx" ON "TestCaseBug"("bugId");

-- CreateIndex
CREATE UNIQUE INDEX "TestCaseBug_caseId_bugId_key" ON "TestCaseBug"("caseId", "bugId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_code_key" ON "Customer"("code");

-- CreateIndex
CREATE INDEX "Customer_status_idx" ON "Customer"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CarModel_code_key" ON "CarModel"("code");

-- CreateIndex
CREATE INDEX "CarModel_brand_idx" ON "CarModel"("brand");

-- CreateIndex
CREATE INDEX "CarModel_status_idx" ON "CarModel"("status");

-- CreateIndex
CREATE INDEX "Contact_customerId_idx" ON "Contact"("customerId");

-- CreateIndex
CREATE INDEX "Contact_role_idx" ON "Contact"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE INDEX "Project_customerId_idx" ON "Project"("customerId");

-- CreateIndex
CREATE INDEX "Project_carModelId_idx" ON "Project"("carModelId");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_pmUserId_idx" ON "Project"("pmUserId");

-- CreateIndex
CREATE INDEX "Project_spaceId_idx" ON "Project"("spaceId");

-- CreateIndex
CREATE INDEX "ExternalDependency_type_idx" ON "ExternalDependency"("type");

-- CreateIndex
CREATE INDEX "ExternalDependency_status_idx" ON "ExternalDependency"("status");

-- CreateIndex
CREATE INDEX "ExternalDependency_expectedDate_idx" ON "ExternalDependency"("expectedDate");

-- CreateIndex
CREATE INDEX "ExternalDependency_projectId_idx" ON "ExternalDependency"("projectId");

-- CreateIndex
CREATE INDEX "ExternalDependency_workItemId_idx" ON "ExternalDependency"("workItemId");

-- CreateIndex
CREATE INDEX "ExternalDependency_spaceId_idx" ON "ExternalDependency"("spaceId");

-- CreateIndex
CREATE INDEX "ExternalDependency_type_status_idx" ON "ExternalDependency"("type", "status");

-- CreateIndex
CREATE INDEX "ExternalDependency_status_expectedDate_idx" ON "ExternalDependency"("status", "expectedDate");

-- CreateIndex
CREATE INDEX "AIReport_type_idx" ON "AIReport"("type");

-- CreateIndex
CREATE INDEX "AIReport_type_createdAt_idx" ON "AIReport"("type", "createdAt");

-- CreateIndex
CREATE INDEX "AIReport_createdAt_idx" ON "AIReport"("createdAt");

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_currentNodeId_fkey" FOREIGN KEY ("currentNodeId") REFERENCES "FlowNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WorkItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_iterationId_fkey" FOREIGN KEY ("iterationId") REFERENCES "Iteration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_carModelId_fkey" FOREIGN KEY ("carModelId") REFERENCES "CarModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemRelation" ADD CONSTRAINT "WorkItemRelation_toId_fkey" FOREIGN KEY ("toId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemRelation" ADD CONSTRAINT "WorkItemRelation_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iteration" ADD CONSTRAINT "Iteration_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowNode" ADD CONSTRAINT "FlowNode_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "NodeFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowTransition" ADD CONSTRAINT "FlowTransition_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "FlowNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowTransition" ADD CONSTRAINT "FlowTransition_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "FlowNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowTransition" ADD CONSTRAINT "FlowTransition_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "NodeFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItem" ADD CONSTRAINT "ReviewItem_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewParticipant" ADD CONSTRAINT "ReviewParticipant_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartConfig" ADD CONSTRAINT "ChartConfig_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceMember" ADD CONSTRAINT "SpaceMember_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SSOSetting" ADD CONSTRAINT "SSOSetting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SSOLog" ADD CONSTRAINT "SSOLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceAllocation" ADD CONSTRAINT "ResourceAllocation_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestPlanCase" ADD CONSTRAINT "TestPlanCase_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestPlanCase" ADD CONSTRAINT "TestPlanCase_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TestPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TestPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCaseBug" ADD CONSTRAINT "TestCaseBug_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_carModelId_fkey" FOREIGN KEY ("carModelId") REFERENCES "CarModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalDependency" ADD CONSTRAINT "ExternalDependency_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalDependency" ADD CONSTRAINT "ExternalDependency_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalDependency" ADD CONSTRAINT "ExternalDependency_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE SET NULL ON UPDATE CASCADE;

