import { isMockMode } from '#/lib/mock-mode'
import * as api from '#/services/api/settings-api'
import * as mock from '#/services/mock/settings-mock'

const useMock = isMockMode()

export const getSecrets = useMock ? mock.mockGetSecrets : api.getSecrets
export const saveSecret = useMock ? mock.mockSaveSecret : api.saveSecret
export const deleteSecret = useMock ? mock.mockDeleteSecret : api.deleteSecret
export const getMcpServers = useMock ? mock.mockGetMcpServers : api.getMcpServers
