import React from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/images/logo.png';
import Footer from '../components/layout/Footer';

// Last reviewed: 2026-09-23; keep Android PrivacyPolicyContent in sync.
// NOTE: If Chess99 has a registered business address, add it to the "Who We Are"
// and "Contact Us" sections below for GDPR data-controller completeness.
const LAST_UPDATED = 'September 23, 2026';
const CONTACT_EMAIL = 'support@chess99.com';

const Section = ({ title, children }) => (
  <section className="mb-8">
    <h2 className="text-xl md:text-2xl font-bold text-white mb-3">{title}</h2>
    <div className="text-[#bababa] text-base leading-relaxed space-y-3">{children}</div>
  </section>
);

const PrivacyPolicy = () => {
  return (
    <>
      <div className="min-h-screen bg-[#1a1a18] px-4 py-10">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <Link to="/">
              <img src={logo} alt="Chess99 Logo" className="h-14 w-auto mx-auto mb-6" />
            </Link>
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-3">Privacy Policy</h1>
            <p className="text-[#8b8987] text-sm">Last updated: {LAST_UPDATED}</p>
          </div>

          <div className="bg-[#312e2b] rounded-2xl p-6 md:p-10 shadow-xl border-2 border-[#3d3a37]">
            <Section title="Who We Are">
              <p>
                Chess99 (“we”, “us”, “our”) operates the online chess platform at{' '}
                <span className="text-white">chess99.com</span> and the Chess99 mobile
                applications (together, the “Service”). This Privacy Policy explains what
                information we collect, how we use it, and the choices you have. By using the
                Service you agree to the practices described here.
              </p>
            </Section>

            <Section title="Information We Collect">
              <p>We collect the following categories of information:</p>
              <ul className="list-disc list-inside space-y-2">
                <li>
                  <span className="text-white font-medium">Account information</span> — your
                  display name, email address, and a securely hashed password when you create
                  an account. We also collect avatars, date of birth for age-related features and optional mobile numbers.
                </li>
                <li>
                  <span className="text-white font-medium">Social login data</span> — if you
                  sign in with Google or Facebook, we receive your name, email address, and
                  profile picture from that provider. We do not receive or store your
                  Google/Facebook password.
                </li>
                <li>
                  <span className="text-white font-medium">Gameplay data</span> — your games,
                  moves, ratings, puzzle and lesson progress, tournament participation, and
                  game history.
                </li>
                <li>
                  <span className="text-white font-medium">Payment information</span> — if you
                  purchase a subscription, payments are processed by our payment provider
                  (Razorpay). We receive confirmation and subscription status; we do{' '}
                  <span className="text-white">not</span> store your full card or banking
                  details on our servers. Where referral or ambassador features are available,
                  we collect application name, mobile number, UPI ID, optional application text,
                  referral relationships, earnings and payout records. UPI IDs are payment
                  information even when Android does not offer purchases.
                </li>
                <li>
                  <span className="text-white font-medium">Communications</span> — in-game
                  chat messages and email preferences (e.g. play reminders, weekly digests,
                  and tournament announcements), sender/recipient and game identifiers,
                  timestamps, safety reports and blocks, and support requests.
                </li>
                <li>
                  <span className="text-white font-medium">Technical &amp; usage data</span> —
                  IP address, browser/device type, and activity on the Service collected
                  through cookies and similar technologies for security and analytics.
                  Android includes Firebase Analytics, Crashlytics and Cloud Messaging for usage
                  events, app/device or installation identifiers, crash diagnostics and push tokens.
                  SDKs may derive approximate location from IP addresses. Meta's Facebook SDK may
                  process device identifiers and technical data as well as login data.
                </li>
              </ul>
            </Section>

            <Section title="How We Use Your Information">
              <ul className="list-disc list-inside space-y-2">
                <li>To create and manage your account and authenticate you.</li>
                <li>To run matchmaking, multiplayer games, ratings, and tournaments.</li>
                <li>To process subscriptions and provide premium features.</li>
                <li>To administer referral/ambassador applications, attribution and payout records where available.</li>
                <li>To send service and (where you opt in) promotional emails.</li>
                <li>To keep the Service secure, prevent fraud, and enforce our terms.</li>
                <li>To improve the Service through aggregated, analytical insights.</li>
              </ul>
            </Section>

            <Section title="Cookies &amp; Analytics">
              <p>
                We use essential cookies to keep you signed in and to secure your session, and
                analytics tools to understand how the Service is used. You can control cookies
                through your browser settings; disabling essential cookies may prevent you from
                logging in or playing.
              </p>
            </Section>

            <Section title="How We Share Information">
              <p>
                We do not sell your personal information. Public profiles, ratings and game
                results are visible to other players; chat is delivered to its participants.
                Referral features may show referred players' names and subscription status to
                their referrer. Providers that process data for the Service include:
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>Google for sign-in and Firebase analytics, crash reporting and notifications; Meta for the Facebook SDK and sign-in.</li>
                <li>Razorpay, for payment processing.</li>
                <li>Our email and hosting providers, for delivering the Service.</li>
                <li>Analytics and error-monitoring providers, including Sentry on the website, for usage measurement and diagnostics.</li>
              </ul>
              <p>
                We may also disclose information if required by law or to protect the rights,
                safety, and security of our users and the Service.
              </p>
            </Section>

            <Section title="Children’s Privacy">
              <p>
                Parents and guardians can contact us to review or request deletion of a child's
                personal information. Where required by law, a parent or guardian should create
                and supervise the account of a child. If you believe a child has provided us
                personal information without appropriate consent, please contact us at{' '}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#81b64c] hover:underline">
                  {CONTACT_EMAIL}
                </a>{' '}
                and we will delete it promptly.
              </p>
            </Section>

            <Section title="Data Retention">
              <p>
                We keep your information for as long as your account is active or as needed to
                provide the Service. When you delete your account, we delete or anonymize your
                personal data, except where we must retain certain records to comply with legal,
                tax, or security obligations. Support will explain any retention period and
                backup or provider processing timelines in its response to a deletion request.
              </p>
            </Section>

            <Section title="Data Security">
              <p>
                We protect your data with industry-standard measures, including encrypted
                connections (HTTPS), hashed passwords, and access controls. No method of
                transmission or storage is completely secure, but we work hard to safeguard
                your information.
              </p>
            </Section>

            <Section title="Your Rights">
              <p>
                Depending on your location, you may have the right to access, correct, export,
                or delete your personal data, and to opt out of marketing emails. You can update
                your profile and email preferences in your account settings, use the unsubscribe
                link in any marketing email, or contact us to exercise these rights.
              </p>
            </Section>

            <Section title="Account and Facebook Data Deletion">
              <p>
                To request deletion of your Chess99 account and associated personal data, visit{' '}
                <a href="/delete-account.html" className="text-[#81b64c] hover:underline">Request account deletion</a>
                {' '}or email{' '}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#81b64c] hover:underline">
                  {CONTACT_EMAIL}
                </a>{' '}
                with the subject “Chess99 account deletion request”. Android users can open
                “Request account deletion” in the home menu. This is a support-assisted process;
                sending the email submits the request. No sign-in or app reinstall is required.
                We aim to complete verified requests within 30 days and will explain any delay
                or retention exception. For Facebook-only data requests, use “Facebook Data Deletion”.
              </p>
            </Section>

            <Section title="International Users">
              <p>
                The Service is operated from India and may be accessed worldwide. By using the
                Service, you understand that your information may be processed in India and other
                countries that may have data-protection laws different from those in your
                jurisdiction.
              </p>
            </Section>

            <Section title="Changes to This Policy">
              <p>
                We may update this Privacy Policy from time to time. When we do, we will revise
                the “Last updated” date above and, where appropriate, notify you through the
                Service. Your continued use of the Service after changes take effect constitutes
                acceptance of the updated policy.
              </p>
            </Section>

            <Section title="Contact Us">
              <p>
                If you have questions about this Privacy Policy or how we handle your data,
                contact us at{' '}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#81b64c] hover:underline">
                  {CONTACT_EMAIL}
                </a>
                .
              </p>
            </Section>

            <div className="text-center mt-10">
              <Link
                to="/"
                className="inline-block bg-[#81b64c] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#a3d160] transition-colors shadow"
              >
                ← Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default PrivacyPolicy;
