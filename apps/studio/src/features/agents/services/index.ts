import { isMockMode } from '#/lib/mock-mode'
import * as api from '#/services/api/agents-api'
import * as mock from '#/services/mock/agents-mock'
import * as chatApi from '#/services/api/chat-api'
import * as chatMock from '#/services/mock/chat-mock'
import * as executionsApi from '#/services/api/executions-api'
import * as executionsMock from '#/services/mock/executions-mock'

const useMock = isMockMode()

export const getAgents = useMock ? mock.mockGetAgents : api.getAgents
export const getAgent = useMock ? mock.mockGetAgent : api.getAgent
export const getAgentEntrypoints = useMock ? mock.mockGetAgentEntrypoints : api.getAgentEntrypoints
export const getAgentRoutes = useMock ? mock.mockGetAgentRoutes : api.getAgentRoutes
export const getAgentTriggers = useMock ? mock.mockGetAgentTriggers : api.getAgentTriggers
export const getAgentContracts = useMock ? mock.mockGetAgentContracts : api.getAgentContracts
export const getAgentState = useMock ? mock.mockGetAgentState : api.getAgentState
export const getAgentChatCapabilities = useMock ? mock.mockGetAgentChatCapabilities : api.getAgentChatCapabilities

export const getChatSessions = useMock ? chatMock.mockGetChatSessions : chatApi.getChatSessions
export const getChatMessages = useMock ? chatMock.mockGetChatMessages : chatApi.getChatMessages
export const sendChatMessage = useMock ? chatMock.mockSendChatMessage : chatApi.sendChatMessage

export const getExecutions = useMock ? executionsMock.mockGetExecutions : executionsApi.getExecutions
