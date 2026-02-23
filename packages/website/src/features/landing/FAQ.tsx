import styled from "styled-components";
import { useRef, useState, useEffect } from "react";

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

const FAQS = [
  {
    q: "Does this use the Reddit API?",
    a: "No. reddit_claw works through your own Chrome browser session. It uses the extension to fetch data from Reddit as if you were browsing manually — no API keys, no rate limits, no OAuth setup.",
  },
  {
    q: "Will Reddit flag or ban my account?",
    a: "Because the extension uses your real authenticated session in a real browser, Reddit sees normal user behavior. There are no headless browsers or proxy rotations involved.",
  },
  {
    q: "Which AI agents are supported?",
    a: "reddit_claw works with OpenClaw out of the box. Any agent that can call HTTP endpoints or use skills can be connected through the bridge server.",
  },
  {
    q: "What happens after I buy?",
    a: "You get a license key instantly. Paste it into the Chrome extension popup. The skill definition, extension, and bridge server are all included — no additional purchases needed.",
  },
  {
    q: "Can I use this on a remote server?",
    a: "Yes. The bridge server can be exposed via Tailscale, ngrok, or SSH tunnel. Your remote agent connects to the bridge, which relays requests to the Chrome extension on your local machine.",
  },
  {
    q: "Is there a subscription or usage limit?",
    a: "No. One-time payment, lifetime access. There are no per-request fees, no monthly charges, and no usage caps. You own it forever.",
  },
];

export function FAQ() {
  const { ref, visible } = useInView();

  return (
    <Section ref={ref}>
      <Container>
        <SectionLabel $visible={visible}>FAQ</SectionLabel>
        <SectionTitle $visible={visible}>
          Frequently asked questions
        </SectionTitle>

        <FAQList $visible={visible}>
          {FAQS.map((faq, i) => (
            <FAQItem key={i}>
              <summary>{faq.q}</summary>
              <FAQAnswer>{faq.a}</FAQAnswer>
            </FAQItem>
          ))}
        </FAQList>
      </Container>
    </Section>
  );
}

const Section = styled.section`
  position: relative;
  padding: var(--section-gap) var(--container-padding);
`;

const Container = styled.div`
  max-width: 680px;
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
  font-size: 28px;
  font-weight: 600;
  text-align: center;
  margin-bottom: 48px;
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  transform: translateY(${(p) => (p.$visible ? 0 : 20)}px);
  transition: all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.1s;
`;

const FAQList = styled.div<{ $visible: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 8px;
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  transform: translateY(${(p) => (p.$visible ? 0 : 16)}px);
  transition: all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.2s;
`;

const FAQItem = styled.details`
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: border-color var(--transition-fast);

  &[open] {
    border-color: var(--accent);
  }

  &:hover {
    border-color: var(--border-hover);
  }

  &[open]:hover {
    border-color: var(--accent);
  }

  summary {
    padding: 16px 20px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    cursor: pointer;
    list-style: none;
    display: flex;
    align-items: center;
    justify-content: space-between;

    &::-webkit-details-marker {
      display: none;
    }

    &::after {
      content: "+";
      font-family: var(--font-mono);
      font-size: 16px;
      color: var(--accent);
      flex-shrink: 0;
      margin-left: 12px;
      transition: transform var(--transition-fast);
    }
  }

  &[open] summary::after {
    content: "−";
  }
`;

const FAQAnswer = styled.div`
  padding: 0 20px 16px;
  font-size: 14px;
  color: var(--text-muted);
  line-height: 1.7;
`;
