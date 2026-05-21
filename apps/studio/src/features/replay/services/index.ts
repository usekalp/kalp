import { isMockMode } from '#/lib/mock-mode'
import * as api from '#/services/api/executions-api'
import * as mock from '#/services/mock/executions-mock'

const useMock = isMockMode()

export const getExecutions = useMock ? mock.mockGetExecutions : api.getExecutions
export const getExecution = useMock ? mock.mockGetExecution : api.getExecution
export const getExecutionEvents = useMock ? mock.mockGetExecutionEvents : api.getExecutionEvents
