import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms and Conditions | Signal Face',
  description: 'The terms that govern access to and use of SignalFace.',
};

const effectiveDate = 'September 14, 2026';

type LegalSection = {
  title: string;
  body?: string[];
  list?: string[];
  after?: string[];
};

const sections: LegalSection[] = [
  {
    title: '1. Agreement',
    body: [
      'These Terms and Conditions ("Terms") govern your access to and use of SignalFace.',
      'By creating an account or using SignalFace, you agree to these Terms. If you do not agree, you must not use the applicable SignalFace services.',
    ],
  },
  {
    title: '2. About SignalFace',
    body: [
      'SignalFace is a digital ecosystem connecting creators, communities, and users. Depending on the version of the platform available to you, SignalFace may provide creator profiles, content publishing, social interaction, creator discovery, communities, rewards, creator monetisation, Signal Credits, Creator Signals, marketplace functionality, wallet services, and payment services.',
      'Not every feature will necessarily be available in every country.',
    ],
  },
  {
    title: '3. Important Financial Disclaimer',
    body: [
      'SignalFace does not guarantee that any user will make a profit. The value of a Creator Signal, where such functionality is legally offered, may increase, decrease, or remain unchanged.',
      'Past performance, engagement, popularity, or audience growth does not guarantee future results. Users should not purchase a Signal based solely on the expectation of making money.',
      'Where SignalFace Signals constitute regulated financial products or securities in a particular jurisdiction, SignalFace will only provide the relevant service where it is legally permitted and appropriately authorised, registered, licensed, exempt, or provided through an appropriately regulated partner.',
    ],
  },
  {
    title: '4. SignalFace Accounts',
    body: [
      'Users must provide accurate information when creating an account. You are responsible for protecting your password, protecting authentication information, maintaining accurate account information, and not allowing unauthorised persons to use your account.',
      'SignalFace may suspend accounts associated with fraud, abuse, identity misrepresentation, or unlawful activity.',
    ],
  },
  {
    title: '5. Creator Accounts',
    body: [
      'Creators may be required to provide additional information for verification.',
    ],
    list: [
      'Own or have permission to publish their content',
      'Provide accurate information',
      'Not manipulate engagement',
      'Not artificially inflate followers or interactions',
      'Not impersonate another person',
      'Not engage in fraudulent activity',
    ],
    after: [
      'SignalFace may remove content or suspend creator accounts that violate these Terms.',
    ],
  },
  {
    title: '6. Content',
    body: [
      'Users retain ownership of content they create, subject to the rights necessary for SignalFace to operate the platform.',
      'By uploading content, you grant SignalFace a limited licence to host, reproduce, display, distribute, and technically process the content as reasonably necessary to operate, promote, and improve the service.',
      'You represent that you have the rights necessary to provide that content.',
    ],
  },
  {
    title: '7. Prohibited Activities',
    list: [
      'Commit fraud',
      'Manipulate markets or platform metrics',
      'Create fake accounts for manipulation',
      'Manipulate engagement',
      'Impersonate others',
      'Upload unlawful content',
      'Infringe intellectual property',
      'Circumvent security',
      'Attack or disrupt the platform',
      'Launder money',
      'Use SignalFace for unlawful financial activity',
      'Misrepresent expected returns',
      'Operate fraudulent investment schemes',
    ],
  },
  {
    title: '8. Signal Credits',
    body: [
      'Signal Credits (SC) may function as a platform purchasing unit. The exact relationship between Signal Credits, fiat currency, and other digital assets will be described in the applicable SignalFace Market Rules.',
      'Signal Credits should not be described as a cryptocurrency, security, investment, or legal tender unless the relevant legal and regulatory structure supports that description.',
    ],
  },
  {
    title: '9. Creator Signals',
    body: [
      'A Creator Signal represents a digital participation or ownership-related interest defined by SignalFace. The exact rights attached to a Creator Signal must be clearly disclosed before purchase.',
      'A Creator Signal does not automatically represent ownership of the creator, the creator company, intellectual property, revenue, shares, or legal assets unless expressly stated in a legally binding agreement.',
    ],
  },
  {
    title: '10. Signal Pricing',
    body: [
      'Where Creator Signals are available, SignalFace may calculate prices or values using a disclosed methodology. Potential factors may include audience growth, engagement, content activity, creator activity, demand, supply, marketplace activity, and other disclosed platform metrics.',
      'SignalFace may modify its methodology where reasonably necessary, subject to applicable law and appropriate notice.',
    ],
  },
  {
    title: '11. Buying and Selling Signals',
    body: [
      'Where marketplace functionality is legally available, users may be able to purchase Signals, hold Signals, sell Signals, and transfer Signals where permitted.',
      'Transaction fees may apply. SignalFace may establish limits, verification requirements, trading restrictions, geographic restrictions, or temporary suspensions.',
    ],
  },
  {
    title: '12. Withdrawals',
    body: [
      'Where withdrawals are available, users must satisfy applicable identity requirements, KYC requirements, AML requirements, payment-provider requirements, and legal requirements.',
      'Withdrawals may be delayed, rejected, or restricted where required for security, fraud prevention, compliance, or technical reasons.',
    ],
  },
  {
    title: '13. Fees',
    body: [
      'SignalFace may charge transaction fees, withdrawal fees, marketplace fees, creator service fees, and other clearly disclosed fees.',
      'Applicable fees should be displayed before the relevant transaction where required by law.',
    ],
  },
  {
    title: '14. Rewards',
    body: [
      'SignalFace may provide rewards for activities such as content participation, community activity, referrals, creator support, and other qualifying activities.',
      'Rewards may be subject to eligibility rules and may not always have cash value. SignalFace reserves the right to modify reward programmes subject to applicable law.',
    ],
  },
  {
    title: '15. No Guarantee of Earnings',
    body: [
      'Nothing on SignalFace constitutes a guarantee that a creator will become successful, a Signal will increase in value, a user will make money, a user will recover money spent, or a particular engagement level will produce a particular financial return.',
      'Users are responsible for their own decisions.',
    ],
  },
  {
    title: '16. Platform Availability',
    body: [
      'SignalFace aims to provide reliable services but does not guarantee that the platform will always be available, error-free, secure, or uninterrupted.',
      'Maintenance, technical failures, cyber incidents, or circumstances beyond our control may temporarily affect services.',
    ],
  },
  {
    title: '17. Account Suspension',
    body: [
      'SignalFace may suspend or terminate accounts where there is fraud, abuse, manipulation, illegal activity, Terms violations, security risk, identity problems, or regulatory requirements.',
    ],
  },
  {
    title: '18. Intellectual Property',
    body: [
      'SignalFace name, logo, software, interface, designs, branding, algorithms, and documentation belong to SignalFace or its licensors unless otherwise stated.',
      'Users may not copy or commercially exploit them without permission.',
    ],
  },
  {
    title: '19. Third-Party Services',
    body: [
      'SignalFace may integrate with third-party services such as payment processors, identity verification providers, cloud infrastructure, analytics, social platforms, and communication providers.',
      'Third-party services may have their own terms and privacy policies.',
    ],
  },
  {
    title: '20. Disclaimers',
    body: [
      'To the maximum extent permitted by law, SignalFace provides the platform on an "as available" basis. Nothing in these Terms excludes rights that cannot legally be excluded.',
    ],
  },
  {
    title: '21. Limitation of Liability',
    body: [
      'To the extent permitted by applicable law, SignalFace will not be responsible for losses arising from market movements, creator performance, user decisions, unauthorised account access caused by user negligence, third-party services, internet failures, or events outside SignalFace control.',
    ],
  },
  {
    title: '22. Dispute Resolution',
    body: [
      'Any dispute relating to SignalFace will be handled according to the dispute-resolution procedure specified by SignalFace and applicable law.',
      'Governing Law: Nigeria, unless another governing law is stated in a separate legally binding agreement.',
      'Dispute Forum: The competent courts or dispute-resolution forum specified by SignalFace and applicable law.',
    ],
  },
  {
    title: '23. Changes to These Terms',
    body: [
      'SignalFace may update these Terms from time to time. Material changes will be communicated through appropriate channels where required.',
      'Continued use of the platform after the effective date may constitute acceptance to the extent permitted by law.',
    ],
  },
  {
    title: '24. Contact',
    body: [
      'SignalFace',
      'Website: signalface.com',
      'Email: legal@signalface.com',
      'Support: support@signalface.com',
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8 lg:py-14">
        <Link href="/app/for-you" className="text-sm font-semibold text-primary hover:underline">
          Back to SignalFace
        </Link>

        <header className="mt-8 border-b border-border pb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">SignalFace</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Terms and Conditions
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">Effective Date: {effectiveDate}</p>
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
              {section.after?.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-7 text-muted-foreground">
                    {paragraph}
                  </p>
                ))}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
