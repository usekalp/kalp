import { Outlet } from '@tanstack/react-router'
import { SettingsTabs } from '#/features/settings/components/settings-tabs'
import { SETTINGS_TABS } from '#/features/settings/constants'

export function SettingsLayoutView() {
  return (
    <div>
      <h1 className="mb-5 text-base font-medium tracking-tight text-white">
        Settings
      </h1>

      <SettingsTabs tabs={SETTINGS_TABS} />

      <Outlet />
    </div>
  )
}

