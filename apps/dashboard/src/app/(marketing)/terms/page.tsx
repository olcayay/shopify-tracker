import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions",
};

export default function TermsPage() {
  return (
    <div className="py-16 px-4 md:px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-bold">Terms & Conditions</h1>
        <p className="mt-2 text-muted-foreground">
          Effective date: February 27, 2026
        </p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">
              1. Acceptance of Terms
            </h2>
            <p className="mt-2">
              By accessing or using AppRanks (&quot;the Service&quot;), operated
              by AppRanks (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;),
              you agree to be bound by these Terms & Conditions. If you do not
              agree, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              2. Description of Service
            </h2>
            <p className="mt-2">
              AppRanks is a Shopify App Store intelligence platform that
              provides app tracking, keyword monitoring, category ranking
              analysis, competitor intelligence, review analytics, ad tracking,
              and related features. The Service is provided on an &quot;as
              is&quot; and &quot;as available&quot; basis.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              3. User Accounts
            </h2>
            <p className="mt-2">
              You must provide accurate and complete information when creating an
              account. You are responsible for maintaining the confidentiality of
              your account credentials and for all activities that occur under
              your account. You must notify us immediately of any unauthorized
              use.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              4. Acceptable Use
            </h2>
            <p className="mt-2">You agree not to:</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>
                Use the Service for any unlawful purpose or in violation of any
                applicable laws or regulations.
              </li>
              <li>
                Attempt to gain unauthorized access to the Service, other
                accounts, or any related systems or networks.
              </li>
              <li>
                Interfere with or disrupt the integrity or performance of the
                Service.
              </li>
              <li>
                Reproduce, duplicate, copy, sell, resell, or exploit any portion
                of the Service without express written permission.
              </li>
              <li>
                Use automated means (bots, scrapers) to access the Service
                beyond normal usage patterns.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              5. Intellectual Property
            </h2>
            <p className="mt-2">
              The Service, including its original content, features, and
              functionality, is owned by AppRanks and is protected by
              international copyright, trademark, and other intellectual
              property laws. You may not use our branding, logos, or trademarks
              without prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              6. Data and Content
            </h2>
            <p className="mt-2">
              The data provided through the Service is collected from publicly
              available sources on the Shopify App Store. We do not guarantee
              the accuracy, completeness, or timeliness of any data. You
              acknowledge that the data is intended for informational purposes
              and should not be the sole basis for business decisions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              7. Disclaimers
            </h2>
            <p className="mt-2">
              The Service is provided &quot;as is&quot; without warranties of
              any kind, whether express or implied, including but not limited to
              implied warranties of merchantability, fitness for a particular
              purpose, and non-infringement. We do not warrant that the Service
              will be uninterrupted, secure, or error-free.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              8. Limitation of Liability
            </h2>
            <p className="mt-2">
              To the fullest extent permitted by law, AppRanks shall not be
              liable for any indirect, incidental, special, consequential, or
              punitive damages, or any loss of profits or revenues, whether
              incurred directly or indirectly, or any loss of data, use,
              goodwill, or other intangible losses resulting from your use of
              the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              9. Termination
            </h2>
            <p className="mt-2">
              We may terminate or suspend your access to the Service
              immediately, without prior notice, for any reason, including
              breach of these Terms. Upon termination, your right to use the
              Service will cease immediately. All provisions which by their
              nature should survive termination shall survive.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              10. Changes to Terms
            </h2>
            <p className="mt-2">
              We reserve the right to modify these Terms at any time. We will
              notify users of material changes by posting the updated Terms on
              this page and updating the effective date. Your continued use of
              the Service after changes constitutes acceptance of the revised
              Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              11. Contact
            </h2>
            <p className="mt-2">
              If you have any questions about these Terms, please contact us at{" "}
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
