import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service | AllFantasy',
  description: 'Terms of Service for AllFantasy - AI-powered fantasy sports platform',
}

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="text-white/50 mb-8">Last updated: {lastUpdated}</p>
        
        <div className="space-y-8 text-white/80 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing or using AllFantasy ("Service"), you agree to be bound by these Terms of Service ("Terms"). 
              If you do not agree to these Terms, do not use the Service. We reserve the right to modify these Terms at any time, 
              and your continued use constitutes acceptance of any modifications.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Description of Service</h2>
            <p>
              AllFantasy provides AI-powered fantasy sports analysis, including but not limited to trade evaluations, 
              waiver recommendations, league rankings, and career statistics. The Service integrates with third-party 
              fantasy sports platforms (Sleeper, Yahoo, MFL, Fantrax) to access publicly available league data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. User Accounts and Responsibilities</h2>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>You must provide accurate information when using the Service</li>
              <li>You are responsible for maintaining the confidentiality of your account</li>
              <li>You must be at least 13 years old to use the Service</li>
              <li>You agree not to use the Service for any illegal or unauthorized purpose</li>
              <li>You agree not to interfere with or disrupt the Service or servers</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Intellectual Property</h2>
            <p>
              All content, features, and functionality of AllFantasy, including but not limited to text, graphics, logos, 
              icons, images, audio, video, software, and the compilation thereof, are the exclusive property of AllFantasy 
              and are protected by copyright, trademark, and other intellectual property laws.
            </p>
            <p className="mt-3">
              You may not reproduce, distribute, modify, create derivative works of, publicly display, publicly perform, 
              republish, download, store, or transmit any of the material on our Service without prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. User Content</h2>
            <p>
              By submitting content to AllFantasy (including feedback, league ideas, and community submissions), you grant us 
              a non-exclusive, worldwide, royalty-free license to use, reproduce, modify, and distribute such content 
              in connection with the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Third-Party Platforms</h2>
            <p>
              The Service integrates with third-party fantasy sports platforms. Your use of those platforms is subject to 
              their respective terms of service and privacy policies. We are not responsible for the practices or content 
              of any third-party platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. Disclaimer of Warranties</h2>
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200">
              <p className="font-bold mb-2">THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND.</p>
              <p>
                AllFantasy disclaims all warranties, express or implied, including but not limited to implied warranties of 
                merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the Service 
                will be uninterrupted, secure, or error-free.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">8. AI-Generated Content Disclaimer</h2>
            <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-200">
              <p>
                AllFantasy uses artificial intelligence to generate analysis, recommendations, and predictions. 
                <strong> AI-generated content is provided for informational and entertainment purposes only.</strong>
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-3">
                <li>We do not guarantee the accuracy, completeness, or reliability of any AI-generated content</li>
                <li>AI recommendations should not be the sole basis for fantasy sports decisions</li>
                <li>Past performance analyzed by AI does not guarantee future results</li>
                <li>You assume all risk associated with relying on AI-generated content</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">9. Limitation of Liability</h2>
            <p className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-200">
              IN NO EVENT SHALL ALLFANTASY, ITS OFFICERS, DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, 
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, 
              DATA, USE, OR OTHER INTANGIBLE LOSSES, RESULTING FROM YOUR ACCESS TO OR USE OF (OR INABILITY TO ACCESS OR USE) 
              THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">10. Indemnification</h2>
            <p>
              You agree to defend, indemnify, and hold harmless AllFantasy and its officers, directors, employees, and agents 
              from and against any claims, liabilities, damages, judgments, awards, losses, costs, or expenses (including 
              reasonable attorneys' fees) arising out of or relating to your violation of these Terms or your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">11. No Gambling or Betting</h2>
            <p>
              AllFantasy is not a gambling or betting service. We do not facilitate, promote, or endorse gambling on fantasy 
              sports or any other activities. Our analysis is intended for entertainment and informational purposes in the 
              context of recreational fantasy sports leagues only.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">12. Termination</h2>
            <p>
              We reserve the right to terminate or suspend your access to the Service immediately, without prior notice or 
              liability, for any reason whatsoever, including without limitation if you breach these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">13. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the United States, 
              without regard to its conflict of law provisions. Any disputes arising under these Terms shall be 
              resolved in the courts of competent jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">14. Severability</h2>
            <p>
              If any provision of these Terms is held to be unenforceable or invalid, such provision will be changed 
              and interpreted to accomplish the objectives of such provision to the greatest extent possible under 
              applicable law, and the remaining provisions will continue in full force and effect.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">15. Entire Agreement</h2>
            <p>
              These Terms, together with our Privacy Policy, constitute the entire agreement between you and AllFantasy 
              regarding your use of the Service and supersede all prior agreements and understandings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">16. Contact Us</h2>
            <p>
              If you have questions about these Terms of Service, please contact us at:
            </p>
            <div className="mt-3 p-4 bg-white/5 rounded-xl border border-white/10">
              <p className="font-semibold text-white">AllFantasy</p>
              <p className="text-white/60">Email: legal@allfantasy.ai</p>
            </div>
          </section>
        </div>
        
        <div className="mt-12 pt-8 border-t border-white/10 text-center">
          <Link href="/privacy" className="text-cyan-400 hover:text-cyan-300 mr-6">Privacy Policy</Link>
          <Link href="/" className="text-white/60 hover:text-white">Back to Home</Link>
        </div>
      </div>
    </main>
  )
}
