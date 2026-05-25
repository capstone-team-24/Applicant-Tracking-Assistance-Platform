'use client'
import Link from "next/link";
import bg from '../../assets/signup-bg.jpg';
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Briefcase, Users, FileCheck, BarChart3, ShieldCheck, FileSearch, ChevronRight, ChevronLeft } from "lucide-react";

export default function HomePage() {

const [index, setIndex] = useState(0);

  // Auto-rotate every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % features.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const nextStep = () => setIndex((prev) => (prev + 1) % features.length);
  const prevStep = () => setIndex((prev) => (prev - 1 + features.length) % features.length);
  
  const features = [
  {
    title: "Job Management",
    desc: "Create, publish, and manage job postings with ease. Set requirements, skills, and scoring criteria.",
    icon: <Briefcase className="w-8 h-8" />,
    image: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&q=80&w=1200",
  },
  {
    title: "Smart Ranking",
    desc: "AI-powered candidate ranking based on skills match, experience, education, and overall fit scores.",
    icon: <Users className="w-8 h-8" />,
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=1200",
  },
  {
    title: "Easy Applications",
    desc: "Simple application process with profile auto-fill, file uploads, and real-time status tracking.",
    icon: <FileCheck className="w-8 h-8" />,
    image: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&q=80&w=1200",
  },
  {
    title: "Analytics Dashboard",
    desc: "Track application progress, view score breakdowns, and get insights into your hiring pipeline.",
    icon: <BarChart3 className="w-8 h-8" />,
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=1200",
  },
  {
    title: "Assessments",
    desc: "Send custom assessments to candidates to evaluate technical skills and cultural fit.",
    icon: <ShieldCheck className="w-8 h-8" />,
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=1200",
  },
  {
    title: "Resume Parsing",
    desc: "Upload your CV and let the system automatically extract and organize your professional information.",
    icon: <FileSearch className="w-8 h-8" />,
    image: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=1200",
  }
];

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
                className="inline-flex items-center justify-center px-8 py-3 bg-white/90 backdrop-blur-sm text-base font-medium rounded-xl text-slate-900 hover:bg-white transition-all shadow-lg"
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
   <section className="relative py-20 px-4 min-h-screen flex items-center overflow-hidden">
  {/* The Underlying Background Image (revealed by transparency) */}
  <div 
    className="absolute inset-0 z-0 opacity-40 bg-cover bg-center"
    style={{ backgroundImage: `url('https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2000')` }}
  />

  <div className="max-w-6xl mx-auto w-full relative z-10">
    <div className="text-center mb-12">
      <h2 className="text-4xl font-extrabold text-white tracking-tight drop-shadow-md">
        Everything You Need
      </h2>
      <p className="mt-4 text-blue-100 text-lg opacity-80">
        Powerful tools for both recruiters and candidates
      </p>
    </div>

    <div className="relative group">
      {/* THE LIQUID GLASS CONTAINER */}
      <div className="overflow-hidden rounded-[2.5rem] border border-white/20 shadow-2xl bg-white/10 backdrop-blur-3xl relative h-[550px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.5 }}
            className="flex h-full flex-col md:flex-row"
          >
            {/* Left Side: Image with Liquid Fade */}
            <div className="relative w-full md:w-3/5 h-1/2 md:h-full overflow-hidden">
              <img 
                src={features[index].image} 
                alt={features[index].title}
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* Fade to transparent/dark rather than solid color */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/30" />
            </div>

            {/* Right Side: Content (Right-aligned text) */}
            <div className="w-full md:w-2/5 p-8 md:p-12 flex flex-col justify-center relative z-10">
              <div className="mb-6 text-white bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg border border-white/30 backdrop-blur-md">
                {features[index].icon}
              </div>
              <h3 className="text-3xl font-bold text-white mb-4 drop-shadow-sm">
                {features[index].title}
              </h3>
              <p className="text-blue-50 text-lg leading-relaxed opacity-90 font-light">
                {features[index].desc}
              </p>
              
              {/* Progress dots */}
              <div className="flex gap-2 mt-8">
                {features.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIndex(i)}
                    className={`h-1 rounded-full transition-all duration-500 ${i === index ? 'w-10 bg-white' : 'w-3 bg-white/20'}`}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows */}
        <button onClick={prevStep} className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 opacity-0 group-hover:opacity-100 transition-all">
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <button onClick={nextStep} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 opacity-0 group-hover:opacity-100 transition-all">
          <ChevronRight className="w-6 h-6 text-white" />
        </button>
      </div>
      
      {/* Background Liquid Accents */}
      <div className="absolute -top-20 -left-20 w-72 h-72 bg-blue-500/30 rounded-full blur-[100px] -z-1 animate-pulse" />
      <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-purple-500/20 rounded-full blur-[120px] -z-1" />
    </div>
  </div>
</section>

<div className="space-y-20 py-20 overflow-hidden">
     {/* CTA SECTION - Prismatic Liquid Glass */}
      <section className="px-4 relative">
        {/* Animated Background Blob for the "Liquid" light bleed */}
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
            x: [0, 50, 0] 
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-0 left-1/4 w-72 h-72 bg-blue-400/20 rounded-full blur-[100px] -z-10"
        />

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto text-center bg-white/10 backdrop-blur-2xl rounded-[3rem] p-12 border border-white/30 shadow-[0_20px_50px_rgba(0,0,0,0.1)] relative overflow-hidden"
        >
          {/* Subtle Inner Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />

          <h2 className="text-4xl font-extrabold text-white mb-4 tracking-tight">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-white/70 mb-10 font-medium">
            Join our platform today and transform your hiring process.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Link
              href="/signup"
              className="group relative px-10 py-4 bg-black text-white font-bold rounded-2xl overflow-hidden transition-transform active:scale-95 shadow-2xl shadow-black/20"
            >
              <span className="relative z-10">Sign Up Now</span>
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" 
              />
            </Link>

            <Link
              href="/jobs"
              className="px-10 py-4 bg-white/20 text-white font-bold rounded-2xl backdrop-blur-md border border-white/20 hover:bg-white/10 transition-all active:scale-95"
            >
              Browse Open Positions
            </Link>
          </div>
        </motion.div>
      </section>

      {/* CONTACT SECTION - Obsidian Dark Glass */}
      <section className="px-4 relative">
        {/* Deep Purple Glow behind the dark glass */}
        <motion.div 
          animate={{ 
            opacity: [0.3, 0.6, 0.3],
            scale: [1, 1.1, 1] 
          }}
          transition={{ duration: 8, repeat: Infinity }}
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] -z-10"
        />

        <motion.div 
          initial={{ y: 30, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto text-center bg-black/40 backdrop-blur-3xl rounded-[3rem] p-12 border border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.4)] relative overflow-hidden"
        >
          {/* Liquid Shine effect across the card */}
          <motion.div 
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", repeatDelay: 3 }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12"
          />

          <h2 className="text-4xl font-bold text-white mb-6">
            Want to Hire with Us?
          </h2>
          <p className="text-lg text-blue-100/60 mb-10 max-w-2xl mx-auto leading-relaxed">
            If you're an organization looking to post jobs and hire top talent, 
            let's build your future team together.
          </p>

          <Link
            href="/contact"
            className="inline-flex items-center justify-center px-12 py-5 bg-purple-600 text-white font-extrabold rounded-2xl transition-all shadow-[0_0_30px_rgba(147,51,234,0.3)] hover:shadow-[0_0_40px_rgba(147,51,234,0.5)] active:scale-95 border border-purple-400/20"
          >
            Contact Us
          </Link>
        </motion.div>
      </section>
	  
	  </div>

    </div>
  );
}