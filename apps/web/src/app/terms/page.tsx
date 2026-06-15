import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms for using MessFit, including the no-medical-advice disclaimer and limits on liability.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="June 2026">
      <p>
        By creating an account or using MessFit, you agree to these terms. If you do
        not agree, please do not use the service.
      </p>

      <LegalSection heading="What MessFit is">
        <p>
          MessFit is an educational and planning tool that suggests meals and workouts
          based on the information you provide and what your mess serves. It is for
          general fitness and wellness purposes only.
        </p>
      </LegalSection>

      <LegalSection heading="Not medical advice">
        <p>
          MessFit does <strong>not</strong> provide medical, nutritional, or
          professional health advice, diagnosis, or treatment. Its targets,
          recommendations, and AI assistant responses are informational and may be
          incomplete or inaccurate. Always consult a qualified doctor or registered
          dietitian before making decisions about your diet, exercise, medication, or a
          medical condition (including PCOS, diabetes, or any other condition). Never
          disregard professional advice because of something you read here. In an
          emergency, contact local emergency services.
        </p>
      </LegalSection>

      <LegalSection heading="Your responsibilities">
        <ul className="ml-5 list-disc space-y-1">
          <li>Provide accurate information and keep your account secure.</li>
          <li>Use the service lawfully and only for your personal, non-commercial use.</li>
          <li>
            Understand that results depend on many factors and are not guaranteed.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Limitation of liability">
        <p>
          To the maximum extent permitted by law, MessFit is provided
          &ldquo;as is&rdquo; without warranties of any kind. We are not liable for any
          indirect, incidental, or consequential damages, or for any health outcomes,
          arising from your use of the service. Where liability cannot be excluded, it
          is limited to the amount you paid us (if any) in the prior 12 months.
        </p>
      </LegalSection>

      <LegalSection heading="Accounts &amp; termination">
        <p>
          You may delete your account at any time from Settings. We may suspend or
          terminate accounts that violate these terms.
        </p>
      </LegalSection>

      <LegalSection heading="Changes">
        <p>
          We may update these terms; material changes will be reflected by the
          &ldquo;last updated&rdquo; date above. Continued use means you accept the
          updated terms.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions: <strong>support@messfit.app</strong>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
