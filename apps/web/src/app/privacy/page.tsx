import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How MessFit collects, uses, and protects your data, and your rights under India's DPDP Act.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="September 2026">
      <p>
        MessFit (&ldquo;we&rdquo;, &ldquo;us&rdquo;) helps Indian hostel students hit
        their nutrition and fitness goals within what their mess serves. This policy
        explains what we collect, why, how long we keep it, and the choices you have.
        It is written to align with India&rsquo;s Digital Personal Data Protection Act,
        2023 (DPDP).
      </p>

      <LegalSection heading="What we collect">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Account data</strong> — email and authentication identifiers,
            handled by our auth provider (Supabase).
          </li>
          <li>
            <strong>Profile &amp; health-related inputs</strong> — age, sex, height,
            weight, activity level, goals, dietary preferences, allergies, and any
            health conditions you choose to enter (e.g. PCOS, diabetes). You provide
            these to get accurate targets and recommendations.
          </li>
          <li>
            <strong>Usage data</strong> — meals, workouts, weigh-ins, and chats you
            log, plus basic technical logs (errors, performance) used to keep the
            service reliable.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Why we use it">
        <p>
          To compute your calorie and macro targets, generate plate and workout
          recommendations, power the AI assistant, show your progress, and operate and
          secure the service. We do <strong>not</strong> sell your personal data.
        </p>
      </LegalSection>

      <LegalSection heading="How it is protected">
        <p>
          Data is stored in a managed PostgreSQL database with row-level security so
          you can only access your own rows. Error-monitoring data is scrubbed of
          personal and health information before it leaves our servers, and we do not
          record session replays of your activity.
        </p>
      </LegalSection>

      <LegalSection heading="Retention &amp; deletion">
        <p>
          We keep your data while your account is active. You can delete your account
          at any time from Settings; we then mark it for deletion and permanently erase
          your personal data within 30 days. Anonymized, non-identifying aggregates may
          be retained for analytics.
        </p>
      </LegalSection>

      <LegalSection heading="Usage analytics">
        <p>
          When you are signed in, MessFit records which features you use and when
          (for example &ldquo;logged a meal&rdquo; or &ldquo;opened an article&rdquo;), linked to your
          account. We do not record what you eat, weigh, log or type, and we do not
          use third-party analytics or advertising trackers: these records are stored in
          our own database, are visible only to MessFit administrators, and are erased
          when your account is deleted. You can switch this off at any time in
          Settings, and we honour your browser&apos;s Do Not Track and Global Privacy
          Control signals.
        </p>
      </LegalSection>

      <LegalSection heading="Your rights">
        <p>
          Under the DPDP Act you can access, correct, and erase your personal data, and
          withdraw consent. Most of this is self-service in the app; for anything else,
          contact us at the email below.
        </p>
      </LegalSection>

      <LegalSection heading="Third-party processors">
        <p>
          We rely on Supabase (auth, database, storage), an LLM provider for the AI
          assistant, and error/performance monitoring. They process data only to
          provide their service to us.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions or data requests: <strong>privacy@messfit.app</strong>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
