import { useMemo, type MouseEvent } from 'react'
import { Check, CreditCard, Sparkles, UserRound, UsersRound, X } from 'lucide-react'
import { getWorkspacePlanOptions } from '../../../features/workspaceOnboarding/workspacePlans'
import type { WorkspacePlanType } from '../../../features/workspaceOnboarding/types'
import './WorkspacePlanPurchaseModal.css'

interface WorkspacePlanPurchaseModalProps {
  ownedPlanTypes: WorkspacePlanType[]
  isStartingCheckout: boolean
  isStartingTestPayment: boolean
  paymentError?: string
  onClose: () => void
  onStartCheckout: (planType: WorkspacePlanType) => Promise<void>
  onStartTestPayment: (planType: WorkspacePlanType) => Promise<void>
}

const PLAN_ICONS: Record<WorkspacePlanType, typeof UserRound> = {
  personal: UserRound,
  team: UsersRound
}

const PLAN_BADGES: Record<WorkspacePlanType, string> = {
  personal: 'Private access',
  team: 'Team access'
}

const OWNED_PLAN_LABELS: Record<WorkspacePlanType, string> = {
  personal: 'Solo workspace already active',
  team: 'Team workspace already active'
}

/**
 * Shows workspace plans that the signed-in user can still purchase.
 *
 * @param props Modal state, owned plans, and checkout callbacks.
 * @returns A plan purchase modal.
 *
 * @example
 * <WorkspacePlanPurchaseModal ownedPlanTypes={['personal']} onStartCheckout={startCheckout} />
 */
const WorkspacePlanPurchaseModal = ({
  ownedPlanTypes,
  isStartingCheckout,
  isStartingTestPayment,
  paymentError = '',
  onClose,
  onStartCheckout,
  onStartTestPayment
}: WorkspacePlanPurchaseModalProps) => {
  const plans = useMemo(() => getWorkspacePlanOptions(), [])
  const ownedPlanSet = useMemo(() => new Set(ownedPlanTypes), [ownedPlanTypes])
  const hasAvailablePlan = plans.some((plan) => !ownedPlanSet.has(plan.type))

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    try {
      if (event.target !== event.currentTarget || isStartingCheckout || isStartingTestPayment) {
        return
      }

      onClose()
    } catch (error) {
      console.error('Failed to close the workspace plan purchase modal:', error)
    }
  }

  const handleStartCheckout = async (planType: WorkspacePlanType) => {
    try {
      if (ownedPlanSet.has(planType) || isStartingCheckout || isStartingTestPayment) {
        return
      }

      await onStartCheckout(planType)
    } catch (error) {
      console.error('Failed to start workspace plan checkout:', error)
    }
  }

  const handleStartTestPayment = async (planType: WorkspacePlanType) => {
    try {
      if (ownedPlanSet.has(planType) || isStartingCheckout || isStartingTestPayment) {
        return
      }

      await onStartTestPayment(planType)
    } catch (error) {
      console.error('Failed to start workspace test payment:', error)
    }
  }

  return (
    <div className="workspace-plan-purchase-modal-overlay" onClick={handleOverlayClick} role="presentation">
      <div
        className="workspace-plan-purchase-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-plan-purchase-title"
        aria-describedby="workspace-plan-purchase-description"
        aria-busy={isStartingCheckout || isStartingTestPayment}
      >
        <button
          type="button"
          className="workspace-plan-purchase-modal__close"
          onClick={onClose}
          disabled={isStartingCheckout || isStartingTestPayment}
          aria-label="Close plan selection"
        >
          <X size={16} />
        </button>

        <div className="workspace-plan-purchase-modal__header">
          <div className="workspace-plan-purchase-modal__icon" aria-hidden="true">
            <Sparkles size={24} />
          </div>
          <div>
            <span className="workspace-plan-purchase-modal__eyebrow">Workspace access</span>
            <h2 id="workspace-plan-purchase-title" className="workspace-plan-purchase-modal__title">
              Buy your own workspace
            </h2>
            <p id="workspace-plan-purchase-description" className="workspace-plan-purchase-modal__description">
              Choose a plan that is not active on your account yet. A team purchase creates your own separate corporate
              workspace, so invited workspaces and your solo workspace stay untouched.
            </p>
          </div>
        </div>

        <div className="workspace-plan-purchase-modal__plans">
          {plans.map((plan) => {
            const isOwned = ownedPlanSet.has(plan.type)
            const PlanIcon = PLAN_ICONS[plan.type]

            return (
              <article
                key={plan.type}
                className={`workspace-plan-purchase-card workspace-plan-purchase-card--${plan.type} ${
                  isOwned ? 'is-owned' : ''
                }`}
              >
                <div className="workspace-plan-purchase-card__top">
                  <div className="workspace-plan-purchase-card__icon" aria-hidden="true">
                    <PlanIcon size={21} />
                  </div>
                  <span className="workspace-plan-purchase-card__badge">
                    {isOwned ? 'Already yours' : PLAN_BADGES[plan.type]}
                  </span>
                </div>

                <h3>{plan.title}</h3>
                <p>{plan.subtitle}</p>

                <div className="workspace-plan-purchase-card__price">
                  <strong>{plan.formattedPrice}</strong>
                  <span>one-time payment</span>
                </div>

                <ul className="workspace-plan-purchase-card__benefits">
                  {plan.benefits.map((benefit) => (
                    <li key={benefit}>
                      <Check size={14} />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  className="workspace-plan-purchase-card__button"
                  onClick={() => {
                    void handleStartCheckout(plan.type)
                  }}
                  disabled={isOwned || isStartingCheckout || isStartingTestPayment}
                >
                  {isOwned ? OWNED_PLAN_LABELS[plan.type] : (
                    <>
                      <CreditCard size={14} />
                      {isStartingCheckout ? 'Opening checkout...' : plan.ctaLabel}
                    </>
                  )}
                </button>
                {!isOwned && (
                  <button
                    type="button"
                    className="workspace-plan-purchase-card__test-button"
                    onClick={() => {
                      void handleStartTestPayment(plan.type)
                    }}
                    disabled={isStartingCheckout || isStartingTestPayment}
                  >
                    {isStartingTestPayment ? 'Activating test...' : 'Test payment'}
                  </button>
                )}
              </article>
            )
          })}
        </div>

        {!hasAvailablePlan && (
          <div className="workspace-plan-purchase-modal__notice success">
            Both workspace plans are already active for your account.
          </div>
        )}
        {paymentError && <div className="workspace-plan-purchase-modal__notice error">{paymentError}</div>}
      </div>
    </div>
  )
}

export default WorkspacePlanPurchaseModal
