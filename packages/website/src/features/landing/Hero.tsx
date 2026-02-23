import styled, { keyframes } from "styled-components";

const slideUp = keyframes`
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
`;

const cursorMove = keyframes`
  0% { top: 30%; left: 20%; }
  25% { top: 25%; left: 55%; }
  50% { top: 60%; left: 45%; }
  75% { top: 50%; left: 70%; }
  100% { top: 30%; left: 20%; }
`;

const tooltipFade = keyframes`
  0%, 15% { opacity: 0; transform: translateY(4px); }
  20%, 45% { opacity: 1; transform: translateY(0); }
  50%, 100% { opacity: 0; transform: translateY(4px); }
`;

export function Hero() {
  return (
    <Section>
      <Container>
        <LeftPane style={{ animationDelay: "0.2s" }}>
          <VersionTag>
            <PulseDot />
            v2.0 RELEASED
          </VersionTag>

          <Headline>
            Reddit automation
            <br />
            <AccentText>for AI agents</AccentText>
          </Headline>

          <Subheadline>
            Give your AI the power to browse, search, and post on Reddit.
            No API keys. No captcha blocks. Just your browser session.
          </Subheadline>

          <CTARow>
            <ChromeButton href="#pricing">
              <ChromeIcon>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="4" />
                  <line x1="21.17" y1="8" x2="12" y2="8" />
                  <line x1="3.95" y1="6.06" x2="8.54" y2="14" />
                  <line x1="10.88" y1="21.94" x2="15.46" y2="14" />
                </svg>
              </ChromeIcon>
              Get Lifetime Access — $50
            </ChromeButton>
            <SecondaryButton href="#how-it-works">See how it works</SecondaryButton>
          </CTARow>
        </LeftPane>

        <RightPane style={{ animationDelay: "0.5s" }}>
          <DemoWindow>
            <DemoTitleBar>
              <DemoDots>
                <span />
                <span />
                <span />
              </DemoDots>
              <DemoTitle>reddit_claw — inspector</DemoTitle>
            </DemoTitleBar>
            <DemoBody>
              {/* Card elements */}
              <DemoCard $top="15%" $left="8%">
                <DemoCardLabel>div.post-card</DemoCardLabel>
                <DemoCardLine />
                <DemoCardLine $short />
              </DemoCard>

              <DemoCard $top="15%" $left="52%">
                <DemoCardLabel>div.score-badge</DemoCardLabel>
                <DemoCardLine />
                <DemoCardLine $short />
              </DemoCard>

              <DemoCard $top="55%" $left="25%">
                <DemoCardLabel>div.comment-tree</DemoCardLabel>
                <DemoCardLine />
                <DemoCardLine $short />
                <DemoCardLine />
              </DemoCard>

              {/* Animated cursor */}
              <Cursor />

              {/* Floating inspector tooltip */}
              <InspectorTooltip>
                <TooltipLine>
                  <TooltipKey>element</TooltipKey>
                  <TooltipVal>.post-card</TooltipVal>
                </TooltipLine>
                <TooltipLine>
                  <TooltipKey>display</TooltipKey>
                  <TooltipVal>flex</TooltipVal>
                </TooltipLine>
                <TooltipLine>
                  <TooltipKey>score</TooltipKey>
                  <TooltipVal>847</TooltipVal>
                </TooltipLine>
                <TooltipLine>
                  <TooltipKey>comments</TooltipKey>
                  <TooltipVal>156</TooltipVal>
                </TooltipLine>
              </InspectorTooltip>
            </DemoBody>
          </DemoWindow>
        </RightPane>
      </Container>
    </Section>
  );
}

const Section = styled.section`
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  padding: 100px var(--container-padding) 80px;
`;

const Container = styled.div`
  max-width: var(--container-max);
  margin: 0 auto;
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 64px;
  align-items: center;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    gap: 48px;
  }
`;

const LeftPane = styled.div`
  animation: ${slideUp} 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
`;

const VersionTag = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 14px;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  color: var(--accent);
  background: var(--accent-subtle);
  border: 1px solid rgba(6, 182, 212, 0.2);
  border-radius: 100px;
  margin-bottom: 28px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const PulseDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  animation: ${pulse} 2s ease-in-out infinite;
`;

const Headline = styled.h1`
  font-size: 72px;
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 0.9;
  margin-bottom: 24px;
  color: var(--text-primary);

  @media (max-width: 1100px) {
    font-size: 56px;
  }
  @media (max-width: 768px) {
    font-size: 44px;
  }
`;

const AccentText = styled.span`
  color: var(--accent);
`;

const Subheadline = styled.p`
  font-size: 16px;
  color: var(--text-secondary);
  max-width: 440px;
  margin-bottom: 36px;
  line-height: 1.7;
`;

const CTARow = styled.div`
  display: flex;
  gap: 12px;

  @media (max-width: 480px) {
    flex-direction: column;
  }
`;

const ChromeButton = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 600;
  color: white;
  background: var(--accent);
  border-radius: var(--radius-md);
  box-shadow: 0 2px 8px var(--accent-glow);
  transition: all var(--transition-base);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px var(--accent-glow);
    background: var(--accent-light);
  }
`;

const ChromeIcon = styled.span`
  display: flex;
  align-items: center;
`;

const SecondaryButton = styled.a`
  display: inline-flex;
  align-items: center;
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  transition: all var(--transition-fast);

  &:hover {
    color: var(--text-primary);
    border-color: var(--accent);
    background: var(--accent-subtle);
  }
`;

const RightPane = styled.div`
  animation: ${slideUp} 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;

  @media (max-width: 900px) {
    max-width: 540px;
  }
`;

const DemoWindow = styled.div`
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-elevated);
  overflow: hidden;
`;

const DemoTitleBar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: #f9fafb;
  border-bottom: 1px solid var(--border);
`;

const DemoDots = styled.div`
  display: flex;
  gap: 6px;
  span {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  span:first-child { background: #ff5f57; }
  span:nth-child(2) { background: #febc2e; }
  span:nth-child(3) { background: #28c840; }
`;

const DemoTitle = styled.span`
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
`;

const DemoBody = styled.div`
  position: relative;
  height: 380px;
  padding: 20px;
  /* Pattern grid inside the demo */
  background-image:
    linear-gradient(rgba(229, 231, 235, 0.4) 1px, transparent 1px),
    linear-gradient(90deg, rgba(229, 231, 235, 0.4) 1px, transparent 1px);
  background-size: 20px 20px;
  overflow: hidden;
`;

const DemoCard = styled.div<{ $top: string; $left: string }>`
  position: absolute;
  top: ${(p) => p.$top};
  left: ${(p) => p.$left};
  width: 40%;
  padding: 14px;
  background: #ffffff;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-panel);
`;

const DemoCardLabel = styled.div`
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--accent);
  margin-bottom: 8px;
  font-weight: 500;
`;

const DemoCardLine = styled.div<{ $short?: boolean }>`
  height: 6px;
  width: ${(p) => (p.$short ? "60%" : "90%")};
  background: var(--border);
  border-radius: 3px;
  margin-bottom: 6px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const Cursor = styled.div`
  position: absolute;
  width: 16px;
  height: 16px;
  z-index: 10;
  animation: ${cursorMove} 8s ease-in-out infinite;

  &::before {
    content: "";
    display: block;
    width: 0;
    height: 0;
    border-left: 6px solid var(--text-primary);
    border-right: 6px solid transparent;
    border-bottom: 10px solid transparent;
    border-top: 10px solid var(--text-primary);
    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2));
  }
`;

const InspectorTooltip = styled.div`
  position: absolute;
  top: 28%;
  left: 22%;
  background: #111827;
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 5;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  animation: ${tooltipFade} 8s ease-in-out infinite;
`;

const TooltipLine = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const TooltipKey = styled.span`
  font-family: var(--font-mono);
  font-size: 10px;
  color: #9ca3af;
`;

const TooltipVal = styled.span`
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--accent);
  font-weight: 500;
`;
