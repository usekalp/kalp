export interface TeamMember {
  name: string
  email: string
  role: 'Owner' | 'Admin' | 'Member'
  isCurrent?: boolean
}

export interface LicensePlan {
  name: string
  price: string
  description: string
  features: string[]
  isEnterprise?: boolean
}
