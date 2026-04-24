import { describe, expect, it } from 'vitest'
import { getWorkspacePlan, getWorkspacePlanOptions } from '../workspacePlans'

describe('workspacePlans', () => {
  it('returns the configured solo and team plans in UI order', () => {
    const plans = getWorkspacePlanOptions()

    expect(plans.map((plan) => plan.type)).toEqual(['personal', 'team'])
    expect(plans[0].amountMinor).toBe(100)
    expect(plans[1].amountMinor).toBe(200)
  })

  it('returns a validated plan definition for known plan types', () => {
    expect(getWorkspacePlan('personal').formattedPrice).toBe('1 UAH')
    expect(getWorkspacePlan('team').formattedPrice).toBe('2 UAH')
    expect(getWorkspacePlan('team').title).toBe('Corporate workspace')
  })

  it('throws when the caller requests an unsupported plan type', () => {
    expect(() => getWorkspacePlan('enterprise' as never)).toThrow()
  })
})
