import Link from "next/link";
import bg from '../../assets/signup-bg.jpg';

export default function HomePage() {
  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-fixed"
      style={{ backgroundImage: `url(${bg.src})` }}
    >
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="text-center bg-white/10 backdrop-blur-md rounded-3xl p-12 border border-white/20 shadow-2xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white">
              ATS Platform
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-white/80 max-w-3xl mx-auto">
              Streamline your hiring process with our intelligent Applicant
              Tracking System. Find the best talent, faster.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/jobs"
                className="inline-flex items-center justify-center px-8 py-3 bg-white/90 backdrop-blur-sm text-base font-medium rounded-xl text-gray-900 hover:bg-white transition-all shadow-lg"
              >
                Browse Jobs
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center px-8 py-3 border-2 border-white/50 bg-white/5 text-base font-medium rounded-xl text-white hover:bg-white/20 transition-all backdrop-blur-sm"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 bg-white/40 backdrop-blur-lg rounded-2xl py-8 border border-white/30 shadow-lg">
            <h2 className="text-3xl font-bold text-gray-900">
              Everything You Need
            </h2>
            <p className="mt-4 text-lg text-gray-700">
              Powerful tools for both recruiters and candidates
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: "Job Management",
                desc: "Create, publish, and manage job postings with ease. Set requirements, skills, and scoring criteria.",
                icon: <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              },
              {
                title: "Smart Ranking",
                desc: "AI-powered candidate ranking based on skills match, experience, education, and overall fit scores.",
                icon: <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              },
              {
                title: "Easy Applications",
                desc: "Simple application process with profile auto-fill, file uploads, and real-time status tracking.",
                icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
              },
              {
                title: "Analytics Dashboard",
                desc: "Track application progress, view score breakdowns, and get insights into your hiring pipeline.",
                icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              },
              {
                title: "Assessments",
                desc: "Send custom assessments to candidates to evaluate technical skills and cultural fit.",
                icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              },
              {
                title: "Resume Parsing",
                desc: "Upload your CV and let the system automatically extract and organize your professional information.",
                icon: <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              }
            ].map((feature, i) => (
              <div key={i} className="bg-white/40 backdrop-blur-md rounded-3xl p-8 hover:bg-white/50 transition-all border border-white/30 shadow-lg group">
                <div className="w-12 h-12 bg-white/60 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-purple-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    {feature.icon}
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center bg-white/60 backdrop-blur-xl rounded-3xl p-12 border border-white/40 shadow-2xl">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-lg text-gray-700 mb-8">
            Join our platform today and transform your hiring process.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center px-8 py-3 bg-black text-white font-bold rounded-xl hover:bg-gray-800 transition-all shadow-xl"
            >
              Sign Up Now
            </Link>
            <Link
              href="/jobs"
              className="inline-flex items-center justify-center px-8 py-3 bg-white/50 text-gray-900 font-bold rounded-xl hover:bg-white/80 transition-all backdrop-blur-sm border border-white/50"
            >
              Browse Open Positions
            </Link>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center bg-black/80 backdrop-blur-md rounded-3xl p-12 border border-white/10 shadow-2xl">
          <h2 className="text-3xl font-bold text-white mb-4">
            Want to Hire with Us?
          </h2>
          <p className="text-lg text-white/70 mb-8 max-w-2xl mx-auto">
            If you&apos;re an organization looking to post jobs and hire top talent on our platform, get in touch and we&apos;ll set you up.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center px-10 py-4 bg-purple-600 text-white font-bold rounded-2xl hover:bg-purple-500 transition-all shadow-lg shadow-purple-500/20"
          >
            Contact Us
          </Link>
        </div>
      </section>
    </div>
  );
}