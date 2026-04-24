import { z } from 'zod'
import type { WorkspacePlanType } from './types'

export const workspacePlanTypeSchema = z.enum(['personal', 'team'])

export interface WorkspacePlanDefinition {
  type: WorkspacePlanType
  title: string
  subtitle: string
  amountMinor: number
  currency: string
  formattedPrice: string
  benefits: string[]
  drawbacks: string[]
  ctaLabel: string
}

const currency = 'UAH'

export const WORKSPACE_PLANS: Record<WorkspacePlanType, WorkspacePlanDefinition> = {
  personal: {
    type: 'personal',
    title: 'Solo workspace',
    subtitle: 'For one creator who wants a private workspace and pays only for personal access.',
    amountMinor: 100,
    currency,
    formattedPrice: '1 UAH',
    benefits: [
      'Private workspace with only your own projects.',
      'Fast setup after payment with no invitation or team management.',
      'Keeps your personal work isolated from team activity.'
    ],
    drawbacks: [
      'Does not include shared access for teammates.',
      'Only you can access the personal workspace.'
    ],
    ctaLabel: 'Pay 1 UAH'
  },
  team: {
    type: 'team',
    title: 'Corporate workspace',
    subtitle: 'For a team lead who pays once and then invites or connects teammates without charging them again.',
    amountMinor: 200,
    currency,
    formattedPrice: '2 UAH',
    benefits: [
      'Shared workspace for the team lead and invited collaborators.',
      'Join teammates by email invite or shared workspace credentials.',
      'Existing solo owners upgrade in place without losing projects.'
    ],
    drawbacks: [
      'The team lead is responsible for member access and credential rotation.',
      'Only one active owned workspace is supported per billing account.'
    ],
    ctaLabel: 'Pay 2 UAH'
  }
}

/**
 * Returns the validated plan definition for a workspace purchase.
 *
 * @param {WorkspacePlanType} planType
 * @returns {WorkspacePlanDefinition}
 *
 * @example
 * const teamPlan = getWorkspacePlan('team')
 */
export const getWorkspacePlan = (planType: WorkspacePlanType): WorkspacePlanDefinition => {
  const validatedPlanType = workspacePlanTypeSchema.parse(planType)
  return WORKSPACE_PLANS[validatedPlanType]
}

/**
 * Returns all supported workspace plan definitions in UI order.
 *
 * @returns {WorkspacePlanDefinition[]}
 *
 * @example
 * const plans = getWorkspacePlanOptions()
 */
export const getWorkspacePlanOptions = (): WorkspacePlanDefinition[] => [
  WORKSPACE_PLANS.personal,
  WORKSPACE_PLANS.team
]
