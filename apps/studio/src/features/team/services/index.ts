import { isMockMode } from '#/lib/mock-mode'
import * as api from '#/services/api/team-api'
import * as mock from '#/services/mock/team-mock'

const useMock = isMockMode()

export const getMembers = useMock ? mock.mockGetMembers : api.getMembers
