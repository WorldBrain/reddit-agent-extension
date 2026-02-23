import styled, { keyframes } from "styled-components";
import { useRef, useState, useEffect } from "react";
import { LEMONSQUEEZY_CHECKOUT_URL } from "reddit-agent-common";
import { CheckoutSuccess } from "./CheckoutSuccess";

const shine = keyframes`
  0% { left: -100%; }
  50%, 100% { left: 100%; }
`;

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVisible(true);
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

declare global {
  interface Window {
    LemonSqueezy?: {
      Setup: (config: {
        eventHandler: (event: { event: string; data?: Record<string, unknown> }) => void;
      }) => void;
    };
    createLemonSqueezy?: () => void;
  }
}

export function Pricing() {
  const { ref, visible } = useInView();
  const [checkoutResult, setCheckoutResult] = useState<{
    licenseKey: string;
    email: string;
  } | null>(null);

  useEffect(() => {
    window.createLemonSqueezy?.();
    window.LemonSqueezy?.Setup({
      eventHandler: (event) => {
        if (event.event === "Checkout.Success") {
          const data = event.data as Record<string, unknown> | undefined;
          const order = data?.order as Record<string, unknown> | undefined;
          const firstItem = order?.first_order_item as Record<string, unknown> | undefined;
          const licenseKey = firstItem?.license_key as string | undefined;
          const email = (order?.user_email as string) || "";
          if (licenseKey) {
            setCheckoutResult({ licenseKey, email });
          }
        }
      },
    });
  }, []);

  return (
    <Section id="pricing" ref={ref}>
      <Container>
        <SectionLabel $visible={visible}>Pricing</SectionLabel>
        <SectionTitle $visible={visible}>
          One price. No surprises.
        </SectionTitle>

        <CardWrapper>
          <PriceCard $visible={visible}>
            <PriceBadge>Launch Offer</PriceBadge>
            <PriceAmount>
              <Dollar>$</Dollar>50
            </PriceAmount>
            <PriceLabel>Lifetime access</PriceLabel>
            <PriceDivider />
            <FeatureList>
              <Feature>
                <FeatureCheck>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </FeatureCheck>
                reddit_claw for OpenClaw
              </Feature>
              <Feature>
                <FeatureCheck>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </FeatureCheck>
                Chrome extension
              </Feature>
              <Feature>
                <FeatureCheck>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </FeatureCheck>
                Bridge server included
              </Feature>
              <Feature>
                <FeatureCheck>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </FeatureCheck>
                All 4 Reddit actions
              </Feature>
            </FeatureList>
            <PriceButton
              href={LEMONSQUEEZY_CHECKOUT_URL}
              className="lemonsqueezy-button"
            >
              Get Lifetime Access
              <ShineEffect />
            </PriceButton>
            <PriceNote>One-time payment. No subscription.</PriceNote>
          </PriceCard>
        </CardWrapper>
      </Container>

      {checkoutResult && (
        <CheckoutSuccess
          licenseKey={checkoutResult.licenseKey}
          customerEmail={checkoutResult.email}
          onClose={() => setCheckoutResult(null)}
        />
      )}
    </Section>
  );
}

const Section = styled.section`
  position: relative;
  padding: var(--section-gap) var(--container-padding);
`;

const Container = styled.div`
  max-width: 800px;
  margin: 0 auto;
`;

const SectionLabel = styled.p<{ $visible: boolean }>`
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--accent);
  margin-bottom: 12px;
  text-align: center;
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  transform: translateY(${(p) => (p.$visible ? 0 : 16)}px);
  transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
`;

const SectionTitle = styled.h2<{ $visible: boolean }>`
  font-size: clamp(2rem, 4.5vw, 2.5rem);
  margin-bottom: 48px;
  text-align: center;
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  transform: translateY(${(p) => (p.$visible ? 0 : 24)}px);
  transition: all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.1s;
`;

const CardWrapper = styled.div`
  max-width: 420px;
  margin: 0 auto;
`;

const PriceCard = styled.div<{ $visible: boolean }>`
  position: relative;
  padding: 40px 36px;
  background: var(--bg-secondary);
  border: 2px solid var(--accent);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-elevated), 0 0 0 4px var(--accent-subtle);
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  transform: translateY(${(p) => (p.$visible ? 0 : 30)}px);
  transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.15s;
`;

const PriceBadge = styled.div`
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 16px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  color: white;
  background: var(--accent);
  border-radius: 100px;
  white-space: nowrap;
  letter-spacing: 0.03em;
`;

const PriceAmount = styled.div`
  font-family: var(--font-heading);
  font-size: 4rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--text-primary);
  margin-bottom: 4px;
`;

const Dollar = styled.span`
  font-size: 1.8rem;
  vertical-align: super;
  margin-right: 2px;
  color: var(--text-muted);
`;

const PriceLabel = styled.p`
  font-size: 1rem;
  color: var(--text-secondary);
  margin-bottom: 24px;
`;

const PriceDivider = styled.div`
  height: 1px;
  background: var(--border);
  margin-bottom: 24px;
`;

const FeatureList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 32px;
  flex: 1;
`;

const Feature = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: var(--text-secondary);
`;

const FeatureCheck = styled.span`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--accent-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--accent);
`;

const PriceButton = styled.a`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px 28px;
  font-size: 15px;
  font-weight: 600;
  color: white;
  background: var(--accent);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: all var(--transition-base);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px var(--accent-glow);
    background: var(--accent-light);
  }
`;

const ShineEffect = styled.span`
  position: absolute;
  top: 0;
  left: -100%;
  width: 60%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.25),
    transparent
  );
  animation: ${shine} 3s ease-in-out infinite;
`;

const PriceNote = styled.p`
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  text-align: center;
  margin-top: 12px;
`;
