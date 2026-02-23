import styled, { keyframes } from "styled-components";
import { useRef, useState, useEffect } from "react";

const flowPulse = keyframes`
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
`;

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

const STEPS = [
  {
    num: "01",
    title: "Install reddit_claw",
    desc: "Add the skill to your OpenClaw setup. One config line.",
    tag: "skill.install()",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
  },
  {
    num: "02",
    title: "Install extension",
    desc: "Load the Chrome extension. It connects to your local bridge server.",
    tag: "chrome.load()",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    num: "03",
    title: "Open the tunnel",
    desc: "Use Tailscale or SSH to expose the bridge. Remote agents connect seamlessly.",
    tag: "tunnel.open()",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    num: "04",
    title: "Agent talks to Reddit",
    desc: "Requests flow through the bridge. The extension fetches data using your session.",
    tag: "agent.run()",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
];

export function HowItWorks() {
  const { ref, visible } = useInView();

  return (
    <Section id="how-it-works" ref={ref}>
      <Container>
        <Label $visible={visible}>Setup</Label>
        <SectionTitle $visible={visible}>
          Up and running in four steps
        </SectionTitle>

        <WorkspaceFrame $visible={visible}>
          <EditorBar>
            <EditorDots>
              <span />
              <span />
              <span />
            </EditorDots>
            <EditorTab>workflow.ts</EditorTab>
          </EditorBar>

          <Canvas>
            <StepsRow>
              {STEPS.map((step, i) => (
                <StepWithConnector key={i}>
                  <StepBlock $visible={visible} $index={i}>
                    <BlockHeader>
                      <BlockNum>{step.num}</BlockNum>
                      <BlockTag>{step.tag}</BlockTag>
                    </BlockHeader>
                    <BlockIcon>{step.icon}</BlockIcon>
                    <BlockTitle>{step.title}</BlockTitle>
                    <BlockDesc>{step.desc}</BlockDesc>
                    <BlockPulse $delay={i * 0.4} />
                  </StepBlock>

                  {i < STEPS.length - 1 && (
                    <Connector $visible={visible} $index={i}>
                      <ConnectorDot />
                      <ConnectorLine />
                      <ConnectorArrow>&rsaquo;</ConnectorArrow>
                      <ConnectorDot />
                    </Connector>
                  )}
                </StepWithConnector>
              ))}
            </StepsRow>
          </Canvas>
        </WorkspaceFrame>
      </Container>
    </Section>
  );
}

const Section = styled.section`
  position: relative;
  padding: var(--section-gap) var(--container-padding);
`;

const Container = styled.div`
  max-width: var(--container-max);
  margin: 0 auto;
`;

const Label = styled.p<{ $visible: boolean }>`
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
  font-size: clamp(2rem, 4.5vw, 3rem);
  margin-bottom: 48px;
  text-align: center;
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  transform: translateY(${(p) => (p.$visible ? 0 : 24)}px);
  transition: all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.1s;
`;

const WorkspaceFrame = styled.div<{ $visible: boolean }>`
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-elevated);
  overflow: hidden;
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  transform: translateY(${(p) => (p.$visible ? 0 : 30)}px);
  transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.15s;
`;

const EditorBar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: #f9fafb;
  border-bottom: 1px solid var(--border);
`;

const EditorDots = styled.div`
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

const EditorTab = styled.span`
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
  padding: 4px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-bottom: 1px solid var(--bg-secondary);
  border-radius: 6px 6px 0 0;
  position: relative;
  bottom: -1px;
`;

const Canvas = styled.div`
  padding: 40px 32px;
  background-image:
    linear-gradient(rgba(229, 231, 235, 0.4) 1px, transparent 1px),
    linear-gradient(90deg, rgba(229, 231, 235, 0.4) 1px, transparent 1px);
  background-size: 20px 20px;

  @media (max-width: 768px) {
    padding: 24px 16px;
  }
`;

const StepsRow = styled.div`
  display: flex;
  align-items: stretch;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const StepWithConnector = styled.div`
  display: flex;
  align-items: stretch;
  flex: 1;
  min-width: 0;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: center;
  }
`;

const StepBlock = styled.div<{ $visible: boolean; $index: number }>`
  position: relative;
  flex: 1;
  padding: 24px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-panel);
  min-width: 0;
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  transform: translateY(${(p) => (p.$visible ? 0 : 24)}px);
  transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${(p) => 0.3 + p.$index * 0.15}s;

  &:hover {
    border-color: var(--accent);
    box-shadow: var(--shadow-panel), 0 0 0 3px var(--accent-subtle);
  }

  @media (max-width: 768px) {
    width: 100%;
    max-width: 360px;
  }
`;

const Connector = styled.div<{ $visible: boolean; $index: number }>`
  display: flex;
  align-items: center;
  gap: 0;
  width: 40px;
  flex-shrink: 0;
  padding: 0 2px;
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  transition: opacity 0.5s ease ${(p) => 0.6 + p.$index * 0.2}s;

  @media (max-width: 768px) {
    width: auto;
    height: 32px;
    flex-direction: column;
    padding: 2px 0;
  }
`;

const ConnectorDot = styled.div`
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
`;

const ConnectorLine = styled.div`
  flex: 1;
  height: 2px;
  background: var(--accent);
  opacity: 0.3;
  background-image: repeating-linear-gradient(
    90deg,
    var(--accent) 0px,
    var(--accent) 5px,
    transparent 5px,
    transparent 9px
  );

  @media (max-width: 768px) {
    width: 2px;
    height: 100%;
    min-height: 8px;
    background-image: repeating-linear-gradient(
      180deg,
      var(--accent) 0px,
      var(--accent) 5px,
      transparent 5px,
      transparent 9px
    );
  }
`;

const ConnectorArrow = styled.span`
  font-size: 18px;
  line-height: 1;
  color: var(--accent);
  flex-shrink: 0;
  margin: 0 -2px;

  @media (max-width: 768px) {
    transform: rotate(90deg);
    margin: -4px 0;
  }
`;

const BlockHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
`;

const BlockNum = styled.span`
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  padding: 2px 8px;
  background: var(--accent-subtle);
  border-radius: 100px;
`;

const BlockTag = styled.span`
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
`;

const BlockIcon = styled.div`
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-subtle);
  border-radius: var(--radius-sm);
  color: var(--accent);
  margin-bottom: 12px;
`;

const BlockTitle = styled.h3`
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--text-primary);
`;

const BlockDesc = styled.p`
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.55;
`;

const BlockPulse = styled.div<{ $delay: number }>`
  position: absolute;
  inset: -3px;
  border-radius: calc(var(--radius-md) + 3px);
  border: 1px solid var(--accent);
  opacity: 0;
  pointer-events: none;
  animation: ${flowPulse} 3s ease-in-out infinite;
  animation-delay: ${(p) => p.$delay}s;
`;
