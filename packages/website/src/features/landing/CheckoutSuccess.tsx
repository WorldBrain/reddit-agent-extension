import styled, { keyframes } from "styled-components";
import { useState } from "react";

interface CheckoutSuccessProps {
  licenseKey: string;
  customerEmail: string;
  onClose: () => void;
}

export function CheckoutSuccess({
  licenseKey,
  customerEmail,
  onClose,
}: CheckoutSuccessProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(licenseKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Overlay onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <SuccessIcon>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </SuccessIcon>
        <Title>Purchase Successful!</Title>
        <Description>
          Your license key has been sent to{" "}
          <strong>{customerEmail}</strong>. Copy it below and paste it
          into the reddit_claw extension popup.
        </Description>
        <LicenseKeyBox>
          <LicenseKeyText>{licenseKey}</LicenseKeyText>
          <CopyButton onClick={handleCopy}>
            {copied ? "Copied!" : "Copy"}
          </CopyButton>
        </LicenseKeyBox>
        <Steps>
          <Step>
            <StepNumber>1</StepNumber>
            Open the reddit_claw extension popup in Chrome
          </Step>
          <Step>
            <StepNumber>2</StepNumber>
            Paste your license key in the License Key field
          </Step>
          <Step>
            <StepNumber>3</StepNumber>
            Click Save to activate
          </Step>
        </Steps>
        <CloseButton onClick={onClose}>Done</CloseButton>
      </Modal>
    </Overlay>
  );
}

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const slideUp = keyframes`
  from { opacity: 0; transform: translateY(24px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 24px;
  animation: ${fadeIn} 0.2s ease;
`;

const Modal = styled.div`
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 48px 40px;
  max-width: 480px;
  width: 100%;
  text-align: center;
  box-shadow: var(--shadow-elevated);
  animation: ${slideUp} 0.35s cubic-bezier(0.16, 1, 0.3, 1);
`;

const SuccessIcon = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
`;

const Title = styled.h3`
  font-size: 1.5rem;
  color: var(--text-primary);
  margin-bottom: 12px;
`;

const Description = styled.p`
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 24px;

  strong {
    color: var(--text-primary);
  }
`;

const LicenseKeyBox = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 16px;
  margin-bottom: 28px;
`;

const LicenseKeyText = styled.code`
  flex: 1;
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--accent);
  word-break: break-all;
  text-align: left;
`;

const CopyButton = styled.button`
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  white-space: nowrap;
  transition: all var(--transition-fast);

  &:hover {
    border-color: var(--accent);
    background: var(--accent-subtle);
  }
`;

const Steps = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 28px;
  text-align: left;
`;

const Step = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: var(--text-secondary);
`;

const StepNumber = styled.span`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--accent-subtle);
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const CloseButton = styled.button`
  width: 100%;
  padding: 14px 28px;
  font-size: 15px;
  font-weight: 600;
  color: white;
  background: var(--accent);
  border-radius: var(--radius-md);
  transition: all var(--transition-base);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px var(--accent-glow);
    background: var(--accent-light);
  }
`;
