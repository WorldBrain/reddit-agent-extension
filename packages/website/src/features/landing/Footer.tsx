import styled from "styled-components";

export function Footer() {
  return (
    <FooterSection>
      <Container>
        <FooterInner>
          <FooterLeft>
            <FooterLogo>
              <LogoIcon>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="8.5" cy="10" r="1.2" fill="var(--accent)" stroke="none" />
                  <circle cx="15.5" cy="10" r="1.2" fill="var(--accent)" stroke="none" />
                  <path d="M8.5 14.5 Q12 17 15.5 14.5" strokeLinecap="round" fill="none" />
                </svg>
              </LogoIcon>
              <LogoText>reddit_claw</LogoText>
            </FooterLogo>
            <FooterTagline>
              AI-powered Reddit automation for OpenClaw.
            </FooterTagline>
          </FooterLeft>

          <FooterLinks>
            <FooterLinkGroup>
              <FooterLinkTitle>Product</FooterLinkTitle>
              <FooterLink href="#features">Features</FooterLink>
              <FooterLink href="#how-it-works">How it works</FooterLink>
              <FooterLink href="#pricing">Pricing</FooterLink>
            </FooterLinkGroup>
            <FooterLinkGroup>
              <FooterLinkTitle>Resources</FooterLinkTitle>
              <FooterLink href="#">Documentation</FooterLink>
              <FooterLink href="/privacy">Privacy & Terms</FooterLink>
              <FooterLink href="#">GitHub</FooterLink>
              <FooterLink href="#">Support</FooterLink>
            </FooterLinkGroup>
          </FooterLinks>
        </FooterInner>

        <FooterBottom>
          <FooterCopy>
            &copy; {new Date().getFullYear()} reddit_claw. All rights
            reserved.
          </FooterCopy>
        </FooterBottom>
      </Container>
    </FooterSection>
  );
}

const FooterSection = styled.footer`
  padding: 80px var(--container-padding) 40px;
  border-top: 1px solid var(--border);
  background: var(--bg-secondary);
`;

const Container = styled.div`
  max-width: var(--container-max);
  margin: 0 auto;
`;

const FooterInner = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 60px;
  margin-bottom: 48px;

  @media (max-width: 640px) {
    flex-direction: column;
    gap: 40px;
  }
`;

const FooterLeft = styled.div`
  max-width: 300px;
`;

const FooterLogo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
`;

const LogoIcon = styled.span`
  display: flex;
  align-items: center;
`;

const LogoText = styled.span`
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
`;

const FooterTagline = styled.p`
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.6;
`;

const FooterLinks = styled.div`
  display: flex;
  gap: 60px;

  @media (max-width: 480px) {
    gap: 40px;
  }
`;

const FooterLinkGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const FooterLinkTitle = styled.span`
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-primary);
  margin-bottom: 4px;
`;

const FooterLink = styled.a`
  font-size: 13px;
  color: var(--text-muted);
  transition: color var(--transition-fast);

  &:hover {
    color: var(--accent);
  }
`;

const FooterBottom = styled.div`
  padding-top: 24px;
  border-top: 1px solid var(--border);
`;

const FooterCopy = styled.p`
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
`;
