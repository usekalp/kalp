import { isMockMode } from '#/lib/mock-mode'
import * as api from '#/services/api/settings-api'
import * as mock from '#/services/mock/settings-mock'

const useMock = isMockMode()

export const updatePassword = useMock ? mock.mockSaveSecret : api.saveSecret
