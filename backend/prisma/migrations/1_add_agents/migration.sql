-- V1.55 AI 专用 Agent — 新增 Agent / AgentSession / AgentMessageFeedback 表

-- CreateTable Agent
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT '💬',
    "systemPrompt" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "allowedPages" TEXT NOT NULL DEFAULT '[]',
    "llmConfigId" TEXT,
    "allowedTools" TEXT NOT NULL DEFAULT '[]',
    "order" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable AgentSession
CREATE TABLE "AgentSession" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '新会话',
    "messages" TEXT NOT NULL DEFAULT '[]',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable AgentMessageFeedback
CREATE TABLE "AgentMessageFeedback" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentMessageFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Agent_enabled_order_idx" ON "Agent"("enabled", "order");
CREATE UNIQUE INDEX "Agent_spaceId_key_key" ON "Agent"("spaceId", "key");

CREATE INDEX "AgentSession_userId_agentId_updatedAt_idx" ON "AgentSession"("userId", "agentId", "updatedAt");
CREATE INDEX "AgentSession_userId_updatedAt_idx" ON "AgentSession"("userId", "updatedAt");

CREATE INDEX "AgentMessageFeedback_sessionId_idx" ON "AgentMessageFeedback"("sessionId");
CREATE UNIQUE INDEX "AgentMessageFeedback_sessionId_messageId_userId_key" ON "AgentMessageFeedback"("sessionId", "messageId", "userId");

-- AddForeignKey
ALTER TABLE "AgentSession" ADD CONSTRAINT "AgentSession_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
