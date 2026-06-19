"use client";

import { useState } from "react";

export default function Page() {
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });

  const projects = [
    {
      title: "Brand Identity for Vertex Coffee",
      category: "Branding",
      desc: "Complete visual identity system including logo, packaging, and digital assets for a specialty coffee roaster.",
      color: "bg-lime-500"
    },
    {
      title: "Momentum Fitness App",
      category: "UI/UX Design",
      desc: "Mobile-first workout tracking application with gamification elements and social features.",
      color: "bg-lime-400"
    },
    {
      title: "Atlas Editorial Magazine",
      category: "Print Design",
      desc: "Art direction and layout design for a quarterly travel and culture publication.",
      color: "bg-lime-300"
    },
    {
      title: "Nexus Tech Conference 2024",
      category: "Event Design",
      desc: "Environmental graphics, stage design, and wayfinding system for a 3-day innovation summit.",
      color: "bg-lime-600"
    },
    {
      title: "Willow Home Goods E-commerce",
      category: "Web Design",
      desc: "Full e-commerce redesign focusing on storytelling and immersive product experiences.",
      color: "bg-lime-500"
    },
    {
      title: "Symphony Streaming Platform",
      category: "Product Design",
      desc: "Interface design for a music streaming service emphasizing artist discovery and curated playlists.",
      color: "bg-lime-400"
    }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log(formData);
  };

  return (
    <main className="bg-zinc-950 text-zinc-100">
      {/* Hero */}
      <section className="min-h-screen flex flex-col justify-center items-center px-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute bg-lime-500 rounded-full animate-pulse"
              style={{
                width: Math.random() * 4 + 1 + "px",
                height: Math.random() * 4 + 1 + "px",
                left: Math.random() * 100 + "%",
                top: Math.random() * 100 + "%",
                animationDelay: Math.random() * 2 + "s",
                animationDuration: Math.random() * 3 + 2 + "s"
              }}
            />
          ))}
        </div>
        <div className="max-w-5xl text-center z-10">
          <div className="inline-block mb-6 px-4 py-2 border border-lime-500 rounded-full text-lime-400 text-sm font-medium">
            Creative Director & Designer
          </div>
          <h1 className="text-6xl sm:text-7xl md:text-8xl font-bold mb-6 leading-tight">
            Crafting Visual
            <span className="block text-lime-400">Experiences</span>
          </h1>
          <p className="text-xl md:text-2xl text-zinc-400 mb-12 max-w-2xl mx-auto">
            Transforming bold ideas into stunning design solutions that connect brands with their audiences
          </p>
          <a
            href="#work"
            className="inline-block px-8 py-4 bg-lime-500 text-zinc-950 font-semibold rounded-full hover:bg-lime-400 transition-all duration-300 hover:scale-105"
          >
            View Selected Work
          </a>
        </div>
        <div className="absolute bottom-8 animate-bounce">
          <svg className="w-6 h-6 text-lime-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      {/* Work */}
      <section id="work" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-5xl md:text-6xl font-bold mb-4">Selected Work</h2>
          <div className="w-20 h-1 bg-lime-500 mb-16"></div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {projects.map((project, idx) => (
              <div
                key={idx}
                className="group cursor-pointer"
              >
                <div className={`${project.color} aspect-[4/3] rounded-lg mb-4 relative overflow-hidden transition-transform duration-500 group-hover:scale-105`}>
                  <div className="absolute inset-0 bg-zinc-950 opacity-0 group-hover:opacity-80 transition-opacity duration-300 flex items-center justify-center">
                    <span className="text-lime-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300">View Project →</span>
                  </div>
                </div>
                <div className="text-sm text-lime-400 mb-2">{project.category}</div>
                <h3 className="text-2xl font-bold mb-2 group-hover:text-lime-400 transition-colors">{project.title}</h3>
                <p className="text-zinc-400">{project.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="py-24 px-6 bg-zinc-900">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-5xl md:text-6xl font-bold mb-6">About Me</h2>
              <div className="w-20 h-1 bg-lime-500 mb-8"></div>
              <p className="text-xl text-zinc-300 mb-6 leading-relaxed">
                I'm a multidisciplinary designer with over 8 years of experience creating impactful visual solutions for forward-thinking brands and startups.
              </p>
              <p className="text-lg text-zinc-400 mb-6 leading-relaxed">
                My approach blends strategic thinking with aesthetic precision, always seeking to push creative boundaries while delivering measurable results. I specialize in brand identity, digital product design, and art direction.
              </p>
              <div className="space-y-4">
                {["Brand Identity", "UI/UX Design", "Art Direction", "Print & Editorial"].map((skill) => (
                  <div key={skill} className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-lime-500 rounded-full"></div>
                    <span className="text-zinc-300 text-lg">{skill}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="aspect-square bg-gradient-to-br from-lime-500 to-lime-700 rounded-2xl"></div>
              <div className="absolute -bottom-6 -right-6 w-48 h-48 border-4 border-lime-500 rounded-2xl"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-5xl md:text-6xl font-bold mb-4 text-center">Let's Work Together</h2>
          <div className="w-20 h-1 bg-lime-500 mb-12 mx-auto"></div>
          <p className="text-xl text-zinc-400 text-center mb-16">
            Have a project in mind? I'd love to hear about it and explore how we can bring your vision to life.
          </p>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <input
                type="text"
                placeholder="Your Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-6 py-4 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:border-lime-500 transition-colors text-zinc-100"
                required
              />
            </div>
            <div>
              <input
                type="email"
                placeholder="Your Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-6 py-4 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:border-lime-500 transition-colors text-zinc-100"
                required
              />
            </div>
            <div>
              <textarea
                placeholder="Tell me about your project"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={6}
                className="w-full px-6 py-4 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:border-lime-500 transition-colors text-zinc-100 resize-none"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full px-8 py-4 bg-lime-500 text-zinc-950 font-semibold rounded-lg hover:bg-lime-400 transition-all duration-300 hover:scale-105"
            >
              Send Message
            </button>
          </form>
          <div className="mt-16 text-center space-y-4">
            <div className="flex justify-center space-x-8 text-zinc-400">
              <a href="mailto:hello@designtest.com" className="hover:text-lime-400 transition-colors">hello@designtest.com</a>
              <span>|</span>
              <a href="tel:+15551234567" className="hover:text-lime-400 transition-colors">+1 555 123 4567</a>
            </div>
            <div className="flex justify-center space-x-6">
              {["Dribbble", "Behance", "Instagram", "LinkedIn"].map((platform) => (
                <a key={platform} href="#" className="text-zinc-500 hover:text-lime-400 transition-colors text-sm">
                  {platform}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-zinc-900">
        <div className="max-w-7xl mx-auto text-center text-zinc-600 text-sm">
          <p>© 2024 Test Portfolio. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}