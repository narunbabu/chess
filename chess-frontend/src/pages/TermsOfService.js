import React from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/images/logo.png';
import Footer from '../components/layout/Footer';

// Last reviewed: 2026-06-24
const LAST_UPDATED = 'June 24, 2026';
const CONTACT_EMAIL = 'support@chess99.com';

const Section = ({ title, children }) => (
  <section className="mb-8">
    <h2 className="text-xl md:text-2xl font-bold text-white mb-3">{title}</h2>
    <div className="text-[#bababa] text-base leading-relaxed space-y-3">{children}</div>
  </section>
);

const TermsOfService = () => {
  return (
    <>
      <div className="min-h-screen bg-[#1a1a18] px-4 py-10">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <Link to="/">
              <img src={logo} alt="Chess99 Logo" className="h-14 w-auto mx-auto mb-6" />
            </Link>
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-3">Terms of Service</h1>
            <p className="text-[#8b8987] text-sm">Last updated: {LAST_UPDATED}</p>
          </div>

          <div className="bg-[#312e2b] rounded-2xl p-6 md:p-10 shadow-xl border-2 border-[#3d3a37]">
            <Section title="1. Acceptance of Terms">
              <p>
                These Terms of Service (“Terms”) govern your use of the Chess99 platform at{' '}
                <span className="text-white">chess99.com</span> and the Chess99 mobile
                applications (together, the “Service”), operated by Chess99 (“we”, “us”, “our”).
                By creating an account or using the Service, you agree to these Terms and to our{' '}
                <Link to="/privacy" className="text-[#81b64c] hover:underline">
                  Privacy Policy
                </Link>
                . If you do not agree, please do not use the Service.
              </p>
            </Section>

            <Section title="2. Educational, Skill-Based Platform">
              <p>
                Chess99 is an educational, skill-based chess learning and play platform. We do{' '}
                <span className="text-white">not</span> offer real-money gaming, betting, or
                gambling of any kind. All ratings, tournaments, and rewards are for learning and
                safe competitive play only and have no monetary value.
              </p>
            </Section>

            <Section title="3. Eligibility &amp; Children">
              <p>
                The Service is designed to be safe and enjoyable for young learners. If you are a
                minor, you may use the Service only with the involvement and consent of a parent
                or guardian, who agrees to be bound by these Terms on the child’s behalf. Parents
                and guardians are responsible for supervising their child’s use of the Service.
              </p>
            </Section>

            <Section title="4. Your Account">
              <p>
                You are responsible for providing accurate information, keeping your login
                credentials secure, and for all activity that occurs under your account. Notify
                us promptly at{' '}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#81b64c] hover:underline">
                  {CONTACT_EMAIL}
                </a>{' '}
                if you suspect unauthorized use. You may sign in using email/password or a social
                login (Google or Facebook).
              </p>
            </Section>

            <Section title="5. Fair Play &amp; Acceptable Use">
              <p>When using the Service, you agree not to:</p>
              <ul className="list-disc list-inside space-y-2">
                <li>
                  Use chess engines, bots, or outside assistance during rated games, or otherwise
                  cheat or manipulate ratings, puzzles, or tournaments.
                </li>
                <li>Harass, abuse, threaten, or use offensive language toward other users (including in chat).</li>
                <li>Create multiple or fake accounts to gain an unfair advantage.</li>
                <li>Attempt to disrupt, reverse-engineer, overload, or gain unauthorized access to the Service.</li>
                <li>Use the Service for any unlawful purpose or in violation of these Terms.</li>
              </ul>
              <p>
                We may issue warnings, restrict features, or suspend or terminate accounts that
                violate these rules.
              </p>
            </Section>

            <Section title="6. Subscriptions, Payments &amp; Refunds">
              <p>
                Some features require a paid subscription. Payments are processed securely by our
                payment provider (Razorpay). Subscriptions renew automatically for the chosen
                billing period unless cancelled before the renewal date. You can manage or cancel
                your subscription from your account settings; cancellation stops future renewals
                and your plan remains active until the end of the current period. Except where
                required by law, payments are non-refundable. For billing questions, contact{' '}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#81b64c] hover:underline">
                  {CONTACT_EMAIL}
                </a>
                .
              </p>
            </Section>

            <Section title="7. User Content">
              <p>
                You retain ownership of content you submit (such as chat messages and profile
                details), and you grant us a limited licence to host and display it solely to
                operate the Service. You are responsible for the content you post and must not
                share unlawful, harmful, or infringing material.
              </p>
            </Section>

            <Section title="8. Intellectual Property">
              <p>
                The Service, including its software, design, logos, lessons, and puzzles, is owned
                by Chess99 or its licensors and is protected by intellectual-property laws. You
                may use the Service for your personal, non-commercial use only and may not copy,
                distribute, or create derivative works without our permission.
              </p>
            </Section>

            <Section title="9. Disclaimers">
              <p>
                The Service is provided “as is” and “as available” without warranties of any kind,
                whether express or implied. We do not guarantee that the Service will be
                uninterrupted, error-free, or secure, and we are not responsible for losses caused
                by circumstances beyond our reasonable control.
              </p>
            </Section>

            <Section title="10. Limitation of Liability">
              <p>
                To the maximum extent permitted by law, Chess99 will not be liable for any
                indirect, incidental, or consequential damages arising from your use of the
                Service. Our total liability for any claim relating to the Service will not exceed
                the amount you paid us in the 12 months before the claim.
              </p>
            </Section>

            <Section title="11. Termination">
              <p>
                You may stop using the Service and delete your account at any time. We may suspend
                or terminate your access if you breach these Terms or if necessary to protect the
                Service or other users. Provisions that by their nature should survive termination
                (such as intellectual property, disclaimers, and limitation of liability) will
                continue to apply.
              </p>
            </Section>

            <Section title="12. Changes to These Terms">
              <p>
                We may update these Terms from time to time. When we do, we will revise the “Last
                updated” date above and, where appropriate, notify you through the Service. Your
                continued use after changes take effect constitutes acceptance of the updated
                Terms.
              </p>
            </Section>

            <Section title="13. Governing Law">
              <p>
                These Terms are governed by the laws of India, without regard to conflict-of-law
                principles. Disputes will be subject to the courts having jurisdiction in India.
              </p>
            </Section>

            <Section title="14. Contact Us">
              <p>
                Questions about these Terms? Contact us at{' '}
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

export default TermsOfService;
