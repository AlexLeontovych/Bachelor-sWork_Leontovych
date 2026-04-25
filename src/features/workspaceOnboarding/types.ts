export type WorkspacePlanType = 'personal' | 'team'
export type WorkspaceRole = 'owner' | 'member'
export type WorkspaceWorkflowRole = 'developer' | 'qa' | 'lead' | null
export type WorkspaceStatus = 'pending_payment' | 'active' | 'archived'
export type WorkspacePaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled'
export type WorkspaceView = 'projects' | 'onboarding'

export interface WorkspaceRecord {
  id: string
  name: string
  type: WorkspacePlanType
  owner_user_id: string
  status: WorkspaceStatus
  paid_at: string | null
  created_at?: string
  updated_at?: string
}

export interface WorkspaceAccess {
  membershipId: string
  workspaceId: string
  workspaceName: string
  workspaceType: WorkspacePlanType
  workspaceRole: WorkspaceRole
  workflowRole: WorkspaceWorkflowRole
  workspaceStatus: WorkspaceStatus
  ownerUserId: string
  paidAt: string | null
}

export interface WorkspaceMember {
  id: string
  workspaceId: string
  userId: string
  email: string | null
  fullName: string | null
  membershipRole: WorkspaceRole
  workflowRole: WorkspaceWorkflowRole
  profileRole: string | null
  banned: boolean
}

export interface WorkspaceInvite {
  id: string
  workspaceId: string
  email: string
  workflowRole: Exclude<WorkspaceWorkflowRole, null>
  status: 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired'
  invitedBy: string
  claimedBy: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

export interface WorkspacePayment {
  id: string
  orderId: string
  workspaceId: string | null
  planType: WorkspacePlanType
  amountMinor: number
  currency: string
  status: WorkspacePaymentStatus
  paidAt: string | null
  createdAt: string | null
  checkoutUrl: string | null
}

export interface WorkspaceJoinCredentialsSummary {
  workspaceId: string
  workspaceLogin: string | null
  hasCredentials: boolean
  isEnabled: boolean
  createdAt: string | null
  rotatedAt: string | null
}

export interface WorkspaceJoinCredentialsSecret extends WorkspaceJoinCredentialsSummary {
  workspaceLogin: string
  workspacePassword: string
  isNew: boolean
}

export interface JoinWorkspaceResult {
  membershipId: string
  workspaceId: string
  workspaceName: string
  workspaceType: WorkspacePlanType
  workspaceRole: WorkspaceRole
  workflowRole: Exclude<WorkspaceWorkflowRole, null>
  ownerUserId: string
}

export interface PostAuthDestination {
  nextView: WorkspaceView
  workspace: WorkspaceAccess | null
}
