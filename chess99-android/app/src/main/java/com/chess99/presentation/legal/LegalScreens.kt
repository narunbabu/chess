package com.chess99.presentation.legal

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/**
 * Native, offline-safe legal pages. These used to be a [com.chess99.presentation.common.WebViewScreen]
 * pointed at chess99.com/privacy|terms — inside a WebView the React SPA shell
 * never rendered its content, so Privacy/Terms showed zero legal text (a Play
 * Store compliance risk for a kids app). The text below is ported verbatim
 * (not paraphrased) from the web source of truth:
 *   - chess-frontend/src/pages/PrivacyPolicy.js
 *   - chess-frontend/src/pages/TermsOfService.js
 * Keep this in sync with the web copy when either changes; both list a
 * "Last reviewed" date that must be bumped together.
 */
data class LegalSection(
    val heading: String,
    val paragraphs: List<String>,
    val bullets: List<String> = emptyList(),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LegalScreen(
    title: String,
    lastUpdated: String,
    sections: List<LegalSection>,
    onNavigateBack: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .padding(padding)
                .padding(horizontal = 20.dp),
            contentPadding = PaddingValues(vertical = 16.dp),
        ) {
            item {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onBackground,
                )
                Text(
                    text = "Last updated: $lastUpdated",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp, bottom = 16.dp),
                )
            }

            items(sections) { section ->
                Column(modifier = Modifier.padding(bottom = 20.dp)) {
                    Text(
                        text = section.heading,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    Column(
                        modifier = Modifier.padding(top = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        section.paragraphs.forEach { paragraph ->
                            Text(
                                text = paragraph,
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        if (section.bullets.isNotEmpty()) {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                section.bullets.forEach { bullet ->
                                    Text(
                                        text = "•  $bullet",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

private const val CONTACT_EMAIL = "support@chess99.com"

/**
 * Verbatim port of chess-frontend/src/pages/PrivacyPolicy.js.
 * Source has 13 <Section> blocks; "Who We Are" through "Contact Us".
 */
object PrivacyPolicyContent {
    const val TITLE = "Privacy Policy"
    const val LAST_UPDATED = "June 24, 2026"

    val sections: List<LegalSection> = listOf(
        LegalSection(
            heading = "Who We Are",
            paragraphs = listOf(
                "Chess99 (“we”, “us”, “our”) operates the online chess platform " +
                    "at chess99.com and the Chess99 mobile applications (together, the “Service”). " +
                    "This Privacy Policy explains what information we collect, how we use it, and the " +
                    "choices you have. By using the Service you agree to the practices described here.",
            ),
        ),
        LegalSection(
            heading = "Information We Collect",
            paragraphs = listOf(
                "We collect the following categories of information:",
            ),
            bullets = listOf(
                "Account information — your display name, email address, and a securely hashed " +
                    "password when you create an account.",
                "Social login data — if you sign in with Google or Facebook, we receive your name, " +
                    "email address, and profile picture from that provider. We do not receive or store " +
                    "your Google/Facebook password.",
                "Gameplay data — your games, moves, ratings, puzzle and lesson progress, tournament " +
                    "participation, and game history.",
                "Payment information — if you purchase a subscription, payments are processed by " +
                    "our payment provider (Razorpay). We receive confirmation and subscription status; " +
                    "we do not store your full card or banking details on our servers.",
                "Communications — in-game chat messages and email preferences (e.g. play reminders, " +
                    "weekly digests, and tournament announcements).",
                "Technical & usage data — IP address, browser/device type, and activity on the " +
                    "Service collected through cookies and similar technologies for security and " +
                    "analytics.",
            ),
        ),
        LegalSection(
            heading = "How We Use Your Information",
            paragraphs = emptyList(),
            bullets = listOf(
                "To create and manage your account and authenticate you.",
                "To run matchmaking, multiplayer games, ratings, and tournaments.",
                "To process subscriptions and provide premium features.",
                "To send service and (where you opt in) promotional emails.",
                "To keep the Service secure, prevent fraud, and enforce our terms.",
                "To improve the Service through aggregated, analytical insights.",
            ),
        ),
        LegalSection(
            heading = "Cookies & Analytics",
            paragraphs = listOf(
                "We use essential cookies to keep you signed in and to secure your session, and " +
                    "analytics tools to understand how the Service is used. You can control cookies " +
                    "through your browser settings; disabling essential cookies may prevent you from " +
                    "logging in or playing.",
            ),
        ),
        LegalSection(
            heading = "How We Share Information",
            paragraphs = listOf(
                "We do not sell your personal information. We share data only with service providers " +
                    "who help us operate the Service, including:",
            ),
            bullets = listOf(
                "Google and Facebook (only if you choose social login).",
                "Razorpay, for payment processing.",
                "Our email and hosting providers, for delivering the Service.",
                "Analytics providers, for usage measurement.",
            ),
        ),
        LegalSection(
            heading = "Children’s Privacy",
            paragraphs = listOf(
                "Chess99 is designed to be enjoyable and safe for young learners. We do not knowingly " +
                    "collect more personal information from children than is necessary to provide the " +
                    "Service. Where required by law, a parent or guardian should create and supervise " +
                    "the account of a child. If you believe a child has provided us personal information " +
                    "without appropriate consent, please contact us at $CONTACT_EMAIL and we will delete " +
                    "it promptly.",
            ),
        ),
        LegalSection(
            heading = "Data Retention",
            paragraphs = listOf(
                "We keep your information for as long as your account is active or as needed to provide " +
                    "the Service. When you delete your account, we delete or anonymize your personal " +
                    "data, except where we must retain certain records to comply with legal, tax, or " +
                    "security obligations.",
            ),
        ),
        LegalSection(
            heading = "Data Security",
            paragraphs = listOf(
                "We protect your data with industry-standard measures, including encrypted connections " +
                    "(HTTPS), hashed passwords, and access controls. No method of transmission or " +
                    "storage is completely secure, but we work hard to safeguard your information.",
            ),
        ),
        LegalSection(
            heading = "Your Rights",
            paragraphs = listOf(
                "Depending on your location, you may have the right to access, correct, export, or " +
                    "delete your personal data, and to opt out of marketing emails. You can update your " +
                    "profile and email preferences in your account settings, use the unsubscribe link in " +
                    "any marketing email, or contact us to exercise these rights.",
            ),
        ),
        LegalSection(
            heading = "Facebook Data Deletion",
            paragraphs = listOf(
                "If you signed in using Facebook and would like us to delete the data associated with " +
                    "your Facebook login, email us at $CONTACT_EMAIL with the subject “Facebook Data " +
                    "Deletion,” or delete your Chess99 account from your profile settings. We will " +
                    "remove the associated personal data within 30 days.",
            ),
        ),
        LegalSection(
            heading = "International Users",
            paragraphs = listOf(
                "The Service is operated from India and may be accessed worldwide. By using the " +
                    "Service, you understand that your information may be processed in India and other " +
                    "countries that may have data-protection laws different from those in your " +
                    "jurisdiction.",
            ),
        ),
        LegalSection(
            heading = "Changes to This Policy",
            paragraphs = listOf(
                "We may update this Privacy Policy from time to time. When we do, we will revise the " +
                    "“Last updated” date above and, where appropriate, notify you through the " +
                    "Service. Your continued use of the Service after changes take effect constitutes " +
                    "acceptance of the updated policy.",
            ),
        ),
        LegalSection(
            heading = "Contact Us",
            paragraphs = listOf(
                "If you have questions about this Privacy Policy or how we handle your data, contact " +
                    "us at $CONTACT_EMAIL.",
            ),
        ),
    )
}

/**
 * Verbatim port of chess-frontend/src/pages/TermsOfService.js.
 * Source has 14 numbered <Section> blocks; "1. Acceptance of Terms" through
 * "14. Contact Us".
 */
object TermsOfServiceContent {
    const val TITLE = "Terms of Service"
    const val LAST_UPDATED = "June 24, 2026"

    val sections: List<LegalSection> = listOf(
        LegalSection(
            heading = "1. Acceptance of Terms",
            paragraphs = listOf(
                "These Terms of Service (“Terms”) govern your use of the Chess99 platform at " +
                    "chess99.com and the Chess99 mobile applications (together, the “Service”), " +
                    "operated by Chess99 (“we”, “us”, “our”). By creating an " +
                    "account or using the Service, you agree to these Terms and to our Privacy Policy. If " +
                    "you do not agree, please do not use the Service.",
            ),
        ),
        LegalSection(
            heading = "2. Educational, Skill-Based Platform",
            paragraphs = listOf(
                "Chess99 is an educational, skill-based chess learning and play platform. We do not " +
                    "offer real-money gaming, betting, or gambling of any kind. All ratings, tournaments, " +
                    "and rewards are for learning and safe competitive play only and have no monetary " +
                    "value.",
            ),
        ),
        LegalSection(
            heading = "3. Eligibility & Children",
            paragraphs = listOf(
                "The Service is designed to be safe and enjoyable for young learners. If you are a " +
                    "minor, you may use the Service only with the involvement and consent of a parent or " +
                    "guardian, who agrees to be bound by these Terms on the child’s behalf. Parents " +
                    "and guardians are responsible for supervising their child’s use of the Service.",
            ),
        ),
        LegalSection(
            heading = "4. Your Account",
            paragraphs = listOf(
                "You are responsible for providing accurate information, keeping your login credentials " +
                    "secure, and for all activity that occurs under your account. Notify us promptly at " +
                    "$CONTACT_EMAIL if you suspect unauthorized use. You may sign in using email/password " +
                    "or a social login (Google or Facebook).",
            ),
        ),
        LegalSection(
            heading = "5. Fair Play & Acceptable Use",
            paragraphs = listOf(
                "When using the Service, you agree not to:",
            ),
            bullets = listOf(
                "Use chess engines, bots, or outside assistance during rated games, or otherwise cheat " +
                    "or manipulate ratings, puzzles, or tournaments.",
                "Harass, abuse, threaten, or use offensive language toward other users (including in " +
                    "chat).",
                "Create multiple or fake accounts to gain an unfair advantage.",
                "Attempt to disrupt, reverse-engineer, overload, or gain unauthorized access to the " +
                    "Service.",
                "Use the Service for any unlawful purpose or in violation of these Terms.",
            ),
        ),
        LegalSection(
            heading = "6. Subscriptions, Payments & Refunds",
            paragraphs = listOf(
                "Some features require a paid subscription. Payments are processed securely by our " +
                    "payment provider (Razorpay). Subscriptions renew automatically for the chosen " +
                    "billing period unless cancelled before the renewal date. You can manage or cancel " +
                    "your subscription from your account settings; cancellation stops future renewals " +
                    "and your plan remains active until the end of the current period. Except where " +
                    "required by law, payments are non-refundable. For billing questions, contact " +
                    "$CONTACT_EMAIL.",
            ),
        ),
        LegalSection(
            heading = "7. User Content",
            paragraphs = listOf(
                "You retain ownership of content you submit (such as chat messages and profile " +
                    "details), and you grant us a limited licence to host and display it solely to " +
                    "operate the Service. You are responsible for the content you post and must not " +
                    "share unlawful, harmful, or infringing material.",
            ),
        ),
        LegalSection(
            heading = "8. Intellectual Property",
            paragraphs = listOf(
                "The Service, including its software, design, logos, lessons, and puzzles, is owned by " +
                    "Chess99 or its licensors and is protected by intellectual-property laws. You may " +
                    "use the Service for your personal, non-commercial use only and may not copy, " +
                    "distribute, or create derivative works without our permission.",
            ),
        ),
        LegalSection(
            heading = "9. Disclaimers",
            paragraphs = listOf(
                "The Service is provided “as is” and “as available” without warranties " +
                    "of any kind, whether express or implied. We do not guarantee that the Service will " +
                    "be uninterrupted, error-free, or secure, and we are not responsible for losses " +
                    "caused by circumstances beyond our reasonable control.",
            ),
        ),
        LegalSection(
            heading = "10. Limitation of Liability",
            paragraphs = listOf(
                "To the maximum extent permitted by law, Chess99 will not be liable for any indirect, " +
                    "incidental, or consequential damages arising from your use of the Service. Our " +
                    "total liability for any claim relating to the Service will not exceed the amount " +
                    "you paid us in the 12 months before the claim.",
            ),
        ),
        LegalSection(
            heading = "11. Termination",
            paragraphs = listOf(
                "You may stop using the Service and delete your account at any time. We may suspend or " +
                    "terminate your access if you breach these Terms or if necessary to protect the " +
                    "Service or other users. Provisions that by their nature should survive termination " +
                    "(such as intellectual property, disclaimers, and limitation of liability) will " +
                    "continue to apply.",
            ),
        ),
        LegalSection(
            heading = "12. Changes to These Terms",
            paragraphs = listOf(
                "We may update these Terms from time to time. When we do, we will revise the “Last " +
                    "updated” date above and, where appropriate, notify you through the Service. " +
                    "Your continued use after changes take effect constitutes acceptance of the updated " +
                    "Terms.",
            ),
        ),
        LegalSection(
            heading = "13. Governing Law",
            paragraphs = listOf(
                "These Terms are governed by the laws of India, without regard to conflict-of-law " +
                    "principles. Disputes will be subject to the courts having jurisdiction in India.",
            ),
        ),
        LegalSection(
            heading = "14. Contact Us",
            paragraphs = listOf(
                "Questions about these Terms? Contact us at $CONTACT_EMAIL.",
            ),
        ),
    )
}
