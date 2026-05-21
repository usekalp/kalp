import type { LicensePlan, TeamMember } from '../types'

export const MEMBERS: TeamMember[] = [
  { name: 'Admin', email: '', role: 'Owner', isCurrent: true },
]

export const PRO_PLAN: LicensePlan = {
  name: 'PRO License',
  price: '$390',
  description: 'Unlock collaboration and operational tooling for teams building serious AI infrastructure with Kalp Studio.',
  features: [
    'Unlimited Team Members',
    'Collaboration',
    'Role-based access control (RBAC)',
    'Multi-Tenant Workspaces',
    'Shared environments & agents',
    'Priority feature access',
  ],
}

export const ENTERPRISE_PLAN: LicensePlan = {
  name: 'Enterprise License',
  price: 'Custom',
  description: 'Designed for organizations operating at scale with advanced compliance, governance, and infrastructure requirements.',
  features: [
    'Everything in PRO',
    'Audit logs & activity tracking',
    'Single Sign On (SSO)',
    'Custom integrations',
    'Priority infrastructure support',
    'Dedicated onboarding & custom support',
  ],
  isEnterprise: true,
}
