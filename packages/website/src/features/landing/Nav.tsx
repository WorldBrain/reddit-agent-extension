import styled, { keyframes } from "styled-components";
import { WEBSITE_URL } from "reddit-agent-common";

const fadeDown = keyframes`
  from { opacity: 0; transform: translateY(-12px); }
  to { opacity: 1; transform: translateY(0); }
`;

export function Nav() {
  const displayedWebsiteHost = WEBSITE_URL.replace(/^https?:\/\//, "");

  return (
    <BrowserFrame>
      {/* Tab Bar with traffic lights */}
      <TabBar>
        <TrafficLights>
          <TrafficDot $color="#ff5f57" />
          <TrafficDot $color="#febc2e" />
          <TrafficDot $color="#28c840" />
        </TrafficLights>
        <Tabs>
          <Tab $active>
            <TabIcon>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <circle cx="8.5" cy="10" r="1.2" fill="currentColor" stroke="none" />
                <circle cx="15.5" cy="10" r="1.2" fill="currentColor" stroke="none" />
                <path d="M8.5 14.5 Q12 17 15.5 14.5" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              </svg>
            </TabIcon>
            reddit_claw
          </Tab>
          <Tab>New Tab</Tab>
        </Tabs>
      </TabBar>

      {/* Address Bar */}
      <AddressBar>
        <NavIcons>
          <NavIcon>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </NavIcon>
          <NavIcon>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </NavIcon>
          <NavIcon>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M23 4v6h-6" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </NavIcon>
        </NavIcons>

        <URLBar>
          <LockIcon>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
            </svg>
          </LockIcon>
          <URLText>{displayedWebsiteHost}</URLText>
        </URLBar>

        <ExtensionArea>
          <InlineLinks>
            <InlineLink href="#features">Features</InlineLink>
            <InlineLink href="#how-it-works">Setup</InlineLink>
            <InlineLink href="#pricing">Pricing</InlineLink>
          </InlineLinks>
          <ExtensionButton href="#pricing" title="Get reddit_claw">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <circle cx="8.5" cy="10" r="1.2" fill="currentColor" stroke="none" />
              <circle cx="15.5" cy="10" r="1.2" fill="currentColor" stroke="none" />
              <path d="M8.5 14.5 Q12 17 15.5 14.5" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            </svg>
          </ExtensionButton>
        </ExtensionArea>
      </AddressBar>
    </BrowserFrame>
  );
}

const BrowserFrame = styled.nav`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: #ffffff;
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow-panel);
  animation: ${fadeDown} 0.8s var(--transition-base) both;
`;

const TabBar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px 0;
  background: #f9fafb;
  border-bottom: 1px solid var(--border);
`;

const TrafficLights = styled.div`
  display: flex;
  gap: 6px;
  padding: 0 4px;
  flex-shrink: 0;
`;

const TrafficDot = styled.div<{ $color: string }>`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: ${(p) => p.$color};
`;

const Tabs = styled.div`
  display: flex;
  gap: 1px;
  flex: 1;
  min-width: 0;
`;

const Tab = styled.div<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 500;
  color: ${(p) => (p.$active ? "var(--text-primary)" : "var(--text-muted)")};
  background: ${(p) => (p.$active ? "#ffffff" : "transparent")};
  border-radius: 8px 8px 0 0;
  border: ${(p) => (p.$active ? "1px solid var(--border)" : "1px solid transparent")};
  border-bottom: ${(p) => (p.$active ? "1px solid #ffffff" : "1px solid transparent")};
  position: relative;
  bottom: -1px;
  white-space: nowrap;
  cursor: default;
  max-width: 200px;
`;

const TabIcon = styled.span`
  display: flex;
  align-items: center;
  color: var(--accent);
`;

const AddressBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #ffffff;
`;

const NavIcons = styled.div`
  display: flex;
  gap: 2px;
  flex-shrink: 0;
`;

const NavIcon = styled.button`
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  transition: all var(--transition-fast);

  &:hover {
    background: var(--bg-primary);
    color: var(--text-secondary);
  }
`;

const URLBar = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 20px;
  min-width: 0;
`;

const LockIcon = styled.span`
  display: flex;
  align-items: center;
  color: var(--text-muted);
  flex-shrink: 0;
`;

const URLText = styled.span`
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ExtensionArea = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
`;

const InlineLinks = styled.div`
  display: flex;
  gap: 16px;

  @media (max-width: 768px) {
    display: none;
  }
`;

const InlineLink = styled.a`
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  transition: color var(--transition-fast);
  white-space: nowrap;

  &:hover {
    color: var(--accent);
  }
`;

const ExtensionButton = styled.a`
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(6, 182, 212, 0.1);
  border-radius: var(--radius-sm);
  color: var(--accent);
  transition: all var(--transition-fast);

  &:hover {
    background: rgba(6, 182, 212, 0.2);
    transform: translateY(-1px);
  }
`;
