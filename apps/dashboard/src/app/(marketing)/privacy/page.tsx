import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <div className="py-16 px-4 md:px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-muted-foreground">
          Effective date: February 27, 2026
        </p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">
              1. Introduction
            </h2>
            <p className="mt-2">
              AppRanks (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;)
              operates the AppRanks platform. This Privacy Policy explains how
              we collect, use, disclose, and safeguard your information when you
              use our Service. Please read this policy carefully.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              2. Information We Collect
            </h2>
            <p className="mt-2 font-medium text-foreground">
              Information you provide:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>
                Account information: name, email address, and password when you
                create an account.
              </li>
              <li>
                Profile information: organization name and team member details.
              </li>
              <li>
                Communication: any information you provide when contacting us
                for support.
              </li>
            </ul>
            <p className="mt-3 font-medium text-foreground">
              Information collected automatically:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>
                Usage data: pages visited, features used, timestamps, and
                interaction patterns.
              </li>
              <li>
                Device information: browser type, operating system, and device
                identifiers.
              </li>
              <li>
                Log data: IP address, access times, and referring URLs.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              3. How We Use Your Information
            </h2>
            <p className="mt-2">We use the information we collect to:</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Provide, maintain, and improve the Service.</li>
              <li>Create and manage your account.</li>
              <li>
                Send transactional emails such as daily digests, alerts, and
                account notifications.
              </li>
              <li>Respond to your requests and support inquiries.</li>
              <li>
                Analyze usage patterns to improve user experience and
                performance.
              </li>
              <li>
                Detect, prevent, and address technical issues or security
                threats.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              4. Data Storage & Security
            </h2>
            <p className="mt-2">
              We implement industry-standard security measures to protect your
              personal information. Your data is stored on secure servers and
              transmitted using encryption. However, no method of transmission
              over the Internet or electronic storage is 100% secure, and we
              cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              5. Cookies & Tracking Technologies
            </h2>
            <p className="mt-2">We use the following technologies:</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>
                <strong className="text-foreground">
                  Essential cookies:
                </strong>{" "}
                Required for authentication and core functionality.
              </li>
              <li>
                <strong className="text-foreground">Analytics:</strong> We use
                Google Analytics to understand how users interact with our
                Service. Google Analytics collects anonymized usage data.
              </li>
              <li>
                <strong className="text-foreground">
                  Session recording:
                </strong>{" "}
                We use Microsoft Clarity to analyze user behavior and improve
                usability. Clarity may record mouse movements, clicks, and
                scrolling activity.
              </li>
            </ul>
            <p className="mt-2">
              You can control cookies through your browser settings. Disabling
              certain cookies may affect the functionality of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              6. Third-Party Services
            </h2>
            <p className="mt-2">
              We may use third-party services that collect, monitor, and analyze
              data to help us improve the Service. These third parties have
              their own privacy policies and we encourage you to review them.
              The data we collect from publicly available sources (Shopify App
              Store) is not personal data and is used solely to provide the
              intelligence features of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              7. Data Sharing
            </h2>
            <p className="mt-2">
              We do not sell, trade, or rent your personal information to third
              parties. We may share your information only in the following
              circumstances:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>With your consent or at your direction.</li>
              <li>
                With service providers who assist us in operating the Service
                (e.g., hosting, analytics).
              </li>
              <li>
                To comply with legal obligations, enforce our Terms, or protect
                our rights.
              </li>
              <li>
                In connection with a merger, acquisition, or sale of assets,
                with prior notice.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              8. Data Retention
            </h2>
            <p className="mt-2">
              We retain your personal information for as long as your account is
              active or as needed to provide the Service. If you delete your
              account, we will remove your personal data within 30 days, except
              where retention is required by law or for legitimate business
              purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              9. Your Rights
            </h2>
            <p className="mt-2">
              Depending on your location, you may have the following rights:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Access and receive a copy of your personal data.</li>
              <li>Rectify inaccurate or incomplete data.</li>
              <li>Request deletion of your personal data.</li>
              <li>Object to or restrict the processing of your data.</li>
              <li>Data portability — receive your data in a structured format.</li>
              <li>Withdraw consent at any time where processing is based on consent.</li>
            </ul>
            <p className="mt-2">
              To exercise these rights, contact us at{" "}
              <a
                href="mailto:support@appranks.io"
                className="text-primary hover:underline"
              >
                support@appranks.io
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              10. Children&apos;s Privacy
            </h2>
            <p className="mt-2">
              The Service is not intended for individuals under the age of 16.
              We do not knowingly collect personal information from children. If
              we become aware that we have collected personal data from a child,
              we will take steps to delete that information promptly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              11. Changes to This Policy
            </h2>
            <p className="mt-2">
              We may update this Privacy Policy from time to time. We will
              notify you of any material changes by posting the new policy on
              this page and updating the effective date. Your continued use of
              the Service after changes constitutes acceptance of the revised
              policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              12. Contact
            </h2>
            <p className="mt-2">
              If you have any questions about this Privacy Policy, please
              contact us at{" "}
              <a
                href="mailto:support@appranks.io"
                className="text-primary hover:underline"
              >
                support@appranks.io
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
