import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy | AllFantasy',
  description: 'Privacy Policy for AllFantasy - AI-powered fantasy sports platform',
}

export default function PrivacyPage() {
  const lastUpdated = 'February 3, 2026'
  
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-950/30 to-gray-900 text-white">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:py-20">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white mb-8 transition"
        >
          ← Back to Home
        </Link>
        
        <h1 className="text-4xl sm:text-5xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
          Privacy Policy
        </h1>
        <p className="text-white/50 mb-8">Last updated: {lastUpdated}</p>
        
        <div className="space-y-8 text-white/80 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Introduction</h2>
            <p>
              AllFantasy ("we," "our," or "us") operates the AllFantasy.ai website and related services (collectively, the "Service"). 
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service.
            </p>
            <p className="mt-3">
              By accessing or using AllFantasy, you agree to this Privacy Policy. If you do not agree with the terms of this policy, 
              please do not access the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Information We Collect</h2>
            
            <h3 className="text-lg font-semibold text-cyan-300 mt-4 mb-2">2.1 Information You Provide</h3>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Fantasy platform usernames (Sleeper, Yahoo, MFL, Fantrax)</li>
              <li>Email address (if you sign up for notifications or early access)</li>
              <li>Feedback and correspondence you send us</li>
              <li>Community league submissions and ideas</li>
            </ul>
            
            <h3 className="text-lg font-semibold text-cyan-300 mt-4 mb-2">2.2 Information Collected Automatically</h3>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Device information (browser type, operating system)</li>
              <li>Usage data (pages visited, features used, time spent)</li>
              <li>IP address and approximate location</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
            
            <h3 className="text-lg font-semibold text-cyan-300 mt-4 mb-2">2.3 Third-Party Platform Data</h3>
            <p>
              When you connect your fantasy sports accounts, we access <strong>publicly available</strong> league data through 
              official APIs provided by platforms like Sleeper, Yahoo Fantasy, MyFantasyLeague, and Fantrax. This includes:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
              <li>League names, settings, and configurations</li>
              <li>Roster compositions and player ownership</li>
              <li>Historical standings, trades, and transactions</li>
              <li>Draft results and waiver activity</li>
            </ul>
            <p className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-sm">
              <strong>Important:</strong> We never request, store, or access your passwords for any third-party platform. 
              We only access data that is publicly available through official APIs.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>To provide, maintain, and improve our Service</li>
              <li>To generate AI-powered fantasy sports analysis and recommendations</li>
              <li>To calculate your career statistics, rankings, and tier progression</li>
              <li>To send you notifications about trades, waivers, and league activity (if opted in)</li>
              <li>To respond to your inquiries and provide customer support</li>
              <li>To detect, prevent, and address technical issues or abuse</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. AI and Machine Learning</h2>
            <p>
              AllFantasy uses artificial intelligence and machine learning to analyze fantasy sports data and provide insights. 
              Your data may be used to:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
              <li>Train and improve our AI models for better recommendations</li>
              <li>Generate personalized trade evaluations and waiver suggestions</li>
              <li>Identify trends and patterns in fantasy sports markets</li>
            </ul>
            <p className="mt-3">
              AI-generated content is provided for informational and entertainment purposes only. We do not guarantee the accuracy 
              of AI predictions or recommendations.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Information Sharing and Disclosure</h2>
            <p>We may share your information in the following circumstances:</p>
            <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
              <li><strong>Service Providers:</strong> Third-party vendors who assist in operating our Service (hosting, analytics, email)</li>
              <li><strong>Legal Requirements:</strong> When required by law, subpoena, or government request</li>
              <li><strong>Protection of Rights:</strong> To protect our rights, privacy, safety, or property</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
            </ul>
            <p className="mt-3 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-300 text-sm">
              We do not sell your personal information to third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Data Retention</h2>
            <p>
              We retain your information for as long as necessary to provide the Service and fulfill the purposes described in this policy. 
              When you delete your account or request data deletion, we will remove your personal information within 30 days, 
              except where retention is required by law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your information against unauthorized access, 
              alteration, disclosure, or destruction. However, no method of transmission over the Internet or electronic storage 
              is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">8. Your Rights and Choices</h2>
            <p>Depending on your location, you may have the following rights:</p>
            <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
              <li><strong>Access:</strong> Request a copy of your personal information</li>
              <li><strong>Correction:</strong> Request correction of inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your personal information</li>
              <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
              <li><strong>Portability:</strong> Request your data in a portable format</li>
            </ul>
            <p className="mt-3">
              To exercise these rights, please contact us at the email provided below.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">9. Cookies and Tracking</h2>
            <p>
              We use cookies and similar technologies to enhance your experience, analyze usage patterns, and deliver personalized content. 
              You can control cookies through your browser settings, but disabling cookies may affect Service functionality.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">10. Children's Privacy</h2>
            <p>
              AllFantasy is not intended for users under the age of 13. We do not knowingly collect personal information from children 
              under 13. If we learn that we have collected information from a child under 13, we will delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">11. International Users</h2>
            <p>
              If you access AllFantasy from outside the United States, please be aware that your information may be transferred to, 
              stored, and processed in the United States. By using the Service, you consent to such transfer and processing.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">12. Third-Party Links</h2>
            <p>
              Our Service may contain links to third-party websites or services. We are not responsible for the privacy practices 
              of these third parties. We encourage you to review their privacy policies before providing any information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">13. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new 
              Privacy Policy on this page and updating the "Last updated" date. Your continued use of the Service after changes 
              constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">14. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <div className="mt-3 p-4 bg-white/5 rounded-xl border border-white/10">
              <p className="font-semibold text-white">AllFantasy</p>
              <p className="text-white/60">Email: privacy@allfantasy.ai</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">15. California Privacy Rights</h2>
            <p>
              California residents have additional rights under the California Consumer Privacy Act (CCPA), including the right to know 
              what personal information is collected, the right to delete personal information, and the right to opt-out of the sale 
              of personal information. As stated above, we do not sell personal information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">16. Disclaimer</h2>
            <p className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200">
              AllFantasy provides fantasy sports analysis and recommendations for entertainment purposes only. We are not affiliated 
              with any professional sports league, fantasy sports platform, or gambling service. Use of our AI-generated content 
              is at your own risk. We make no warranties regarding the accuracy, completeness, or reliability of any analysis or recommendation.
            </p>
          </section>
        </div>
        
        <div className="mt-12 pt-8 border-t border-white/10 text-center">
          <Link href="/terms" className="text-cyan-400 hover:text-cyan-300 mr-6">Terms of Service</Link>
          <Link href="/" className="text-white/60 hover:text-white">Back to Home</Link>
        </div>
      </div>
    </main>
  )
}
