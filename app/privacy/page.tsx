import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | Signal Face',
  description: 'How SignalFace collects, uses, stores, protects, and discloses personal information.',
};

const effectiveDate = 'September 14, 2026';

type LegalSection = {
  title: string;
  body?: string[];
  list?: string[];
};

const sections: LegalSection[] = [
  {
    title: '1. Introduction',
    body: [
      'Welcome to SignalFace ("SignalFace", "we", "us", or "our"). SignalFace is a digital ecosystem designed to connect content creators, communities, and users through content, discovery, rewards, creator tools, and digital participation.',
      'This Privacy Policy explains how we collect, use, store, protect, and disclose personal information when you use the SignalFace website, mobile application, and related services.',
      'By using SignalFace, you acknowledge that you have read and understood this Privacy Policy.',
      'SignalFace will process personal data in accordance with applicable data-protection laws, including the Nigeria Data Protection Act 2023 where applicable.',
    ],
  },
  {
    title: '2. Information We Collect',
    body: [
      'Depending on how you use SignalFace, we may collect account information, including full name, username, email address, telephone number, date of birth, password or authentication information, profile photograph, country, and general location.',
      'Creators may provide creator names, social-media information, biographies, content, audience information, engagement statistics, payment information, and business information.',
      'Where applicable, we may collect transaction information relating to purchases, Signal transactions, wallet activity, rewards, deposits, withdrawals, and transaction history.',
      'We may also collect technical information such as IP address, device type, operating system, browser information, login information, approximate location, usage activity, cookies, and similar technologies.',
    ],
  },
  {
    title: '3. How We Use Your Information',
    list: [
      'Create and maintain accounts',
      'Provide SignalFace services',
      'Display creator profiles',
      'Calculate engagement metrics',
      'Operate creator tools',
      'Process transactions and provide rewards',
      'Prevent fraud and abuse',
      'Protect account security',
      'Improve our platform',
      'Provide customer support',
      'Send important service communications',
      'Personalise recommendations',
      'Comply with applicable law and respond to lawful requests',
    ],
  },
  {
    title: '4. Creator and Engagement Data',
    body: [
      'SignalFace may analyse publicly available or platform-generated engagement information such as followers, views, likes, comments, shares, content activity, audience growth, and creator activity.',
      'Where engagement information is used in calculating a Creator Signal or other platform metric, the methodology should be disclosed separately in the relevant Signal Methodology or Market Rules.',
    ],
  },
  {
    title: '5. Legal Bases for Processing',
    body: [
      'Depending on the circumstances, SignalFace may process information based on consent, performance of a contract, legal obligations, legitimate interests, protection of rights and security, or other lawful bases permitted by applicable law.',
    ],
  },
  {
    title: '6. Sharing Information',
    body: [
      'We may share information with payment processors, identity-verification providers, cloud hosting providers, analytics providers, security providers, customer-support providers, professional advisers, regulators, government authorities where legally required, and business partners where necessary to provide requested services.',
      'We will not sell personal information merely for the purpose of selling user personal data.',
    ],
  },
  {
    title: '7. International Transfers',
    body: [
      'SignalFace may use service providers located in other countries. Where personal information is transferred internationally, SignalFace will take reasonable measures required by applicable data-protection law.',
    ],
  },
  {
    title: '8. Data Security',
    body: [
      'We use reasonable technical and organisational safeguards designed to protect personal information from unauthorised access, loss, destruction, alteration, disclosure, and fraudulent activity.',
      'However, no internet system can guarantee absolute security.',
    ],
  },
  {
    title: '9. Data Retention',
    body: [
      'We retain personal information only for as long as reasonably necessary for providing services, maintaining accounts, legal obligations, dispute resolution, fraud prevention, security, and legitimate business purposes.',
      'When information is no longer required, it may be deleted, anonymised, or securely archived as permitted by law.',
    ],
  },
  {
    title: '10. Your Privacy Rights',
    list: [
      'Right to access your information',
      'Right to correct inaccurate information',
      'Right to request deletion',
      'Right to object to certain processing',
      'Right to withdraw consent where consent is the legal basis',
      'Right to data portability where applicable',
      'Rights relating to automated decision-making where applicable',
      'Right to lodge a complaint with the appropriate data-protection authority',
    ],
  },
  {
    title: '11. Cookies',
    body: [
      'SignalFace may use cookies and similar technologies for login, security, preferences, analytics, performance, and personalisation.',
      'Users may control cookies through their browser or available SignalFace settings.',
    ],
  },
  {
    title: '12. Children\'s Privacy',
    body: [
      'SignalFace is not intended for children below the minimum age permitted by applicable law.',
      'Where SignalFace provides financial, trading, wallet, or other regulated services, eligibility and age requirements may be stricter.',
      'We may restrict or terminate accounts where age or identity requirements are not satisfied.',
    ],
  },
  {
    title: '13. Changes to This Privacy Policy',
    body: [
      'We may update this Privacy Policy from time to time. The updated version will be published on SignalFace and will indicate its effective date.',
    ],
  },
  {
    title: '14. Contact',
    body: [
      'SignalFace',
      'Website: signalface.com',
      'Email: privacy@signalface.com',
      'Data Protection Contact: privacy@signalface.com',
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8 lg:py-14">
        <Link href="/app/for-you" className="text-sm font-semibold text-primary hover:underline">
          Back to SignalFace
        </Link>

        <header className="mt-8 border-b border-border pb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">SignalFace</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">Privacy Policy</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Effective Date: {effectiveDate} | Last Updated: {effectiveDate}
          </p>
        </header>

        <div className="mt-8 space-y-8">
          {sections.map((section) => (
            <section key={section.title} className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">{section.title}</h2>
              {section.body?.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-7 text-muted-foreground">
                    {paragraph}
                  </p>
                ))}
              {section.list && (
                <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-muted-foreground">
                  {section.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
