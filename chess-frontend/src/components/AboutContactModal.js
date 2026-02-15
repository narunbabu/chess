import React from 'react';
// Optimized logo images (WebP + PNG fallback)
import logo200wWebP from '../assets/images/optimized/logo-200w.webp';
import logo200wPng from '../assets/images/optimized/logo-200w.png';
import logo400wWebP from '../assets/images/optimized/logo-400w.webp';
import logo400wPng from '../assets/images/optimized/logo-400w.png';

const AboutContactModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-[#312e2b] rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border-2 border-[#3d3a37]">
        {/* Header */}
        <div className="sticky top-0 text-white p-6 rounded-t-2xl border-b border-[#4e7837]" style={{ background: 'linear-gradient(135deg, #4e7837, #81b64c)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <picture>
                <source srcSet={`${logo200wWebP} 1x, ${logo400wWebP} 2x`} type="image/webp" />
                <source srcSet={`${logo200wPng} 1x, ${logo400wPng} 2x`} type="image/png" />
                <img src={logo200wPng} alt="Chess99 Logo" className="h-10 w-auto" width="200" height="67" />
              </picture>
              <h2 className="text-2xl font-bold">About Chess99</h2>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-8">
          {/* Our Company & Vision */}
          <div className="mb-10">
            <h3 className="text-2xl font-bold text-white mb-4 flex items-center">
              <span className="text-3xl mr-3">🏢</span>
              Our Company & Vision
            </h3>
            <p className="text-[#bababa] leading-relaxed mb-4">
              Founded in 2017 in Hyderabad, Telangana, AMEYEM has been at the forefront of
              educational technology innovation, leveraging cutting-edge AI/ML technologies and
              deep domain expertise to transform traditional learning approaches.
            </p>
            <p className="text-[#bababa] leading-relaxed">
              Our vision is to make kids more skilled, technologically aware, and logically
              advanced, helping create bright Indians who can compete on the global stage.
              Chess99 is our flagship platform designed to make chess learning accessible,
              engaging, and effective for children across India.
            </p>
          </div>

          {/* Our Mission */}
          <div className="mb-10">
            <h3 className="text-2xl font-bold text-white mb-4 flex items-center">
              <span className="text-3xl mr-3">🎯</span>
              Our Mission
            </h3>
            <p className="text-[#bababa] leading-relaxed">
              AMEYEM Geo Solutions started operations with a mission to instill efficiency in
              educational activities by leveraging cutting-edge AI/ML technologies and deep
              domain expertise. We bridge the gap between traditional educational practices
              and modern computational approaches, making learning more effective, engaging,
              and accessible to every child.
            </p>
          </div>

          {/* Chess99 Platform */}
          <div className="mb-10">
            <h3 className="text-2xl font-bold text-white mb-4 flex items-center">
              <span className="text-3xl mr-3">♟️</span>
              Chess99 Platform
            </h3>
            <p className="text-[#bababa] leading-relaxed mb-4">
              Chess99 is India's #1 Online Chess Academy for Kids, designed to make chess learning
              fun, safe, and educational. Our platform provides:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#262421] p-4 rounded-lg border border-[#3d3a37]">
                <h4 className="font-semibold text-[#81b64c] mb-2">🛡️ 100% Safe Environment</h4>
                <p className="text-sm text-[#bababa]">No ads, no unsafe chats, monitored environment</p>
              </div>
              <div className="bg-[#262421] p-4 rounded-lg border border-[#3d3a37]">
                <h4 className="font-semibold text-[#81b64c] mb-2">📚 Educational Focus</h4>
                <p className="text-sm text-[#bababa]">Skill-based learning, not gambling</p>
              </div>
              <div className="bg-[#262421] p-4 rounded-lg border border-[#3d3a37]">
                <h4 className="font-semibold text-[#81b64c] mb-2">🧠 Cognitive Development</h4>
                <p className="text-sm text-[#bababa]">Builds logic, critical thinking, and strategy</p>
              </div>
              <div className="bg-[#262421] p-4 rounded-lg border border-[#3d3a37]">
                <h4 className="font-semibold text-[#81b64c] mb-2">👥 Age-Appropriate</h4>
                <p className="text-sm text-[#bababa]">Designed specifically for ages 5-16</p>
              </div>
            </div>
          </div>

          {/* Corporate Information */}
          <div className="mb-10">
            <h3 className="text-2xl font-bold text-white mb-4 flex items-center">
              <span className="text-3xl mr-3">📋</span>
              Corporate Information
            </h3>
            <div className="bg-[#262421] rounded-lg p-6 border border-[#3d3a37]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-[#8b8987] mb-1">Company</p>
                  <p className="font-semibold text-white">AMEYEM GEO SOLUTIONS PRIVATE LIMITED</p>
                </div>
                <div>
                  <p className="text-sm text-[#8b8987] mb-1">CIN</p>
                  <p className="font-semibold text-white">U72900TG2016PTC112396</p>
                </div>
                <div>
                  <p className="text-sm text-[#8b8987] mb-1">Location</p>
                  <p className="font-semibold text-white">Vanasthalipuram, Hyderabad, Rangareddy, Telangana, 500070</p>
                </div>
                <div>
                  <p className="text-sm text-[#8b8987] mb-1">Contact</p>
                  <p className="font-semibold text-white">info@ameyem.com, +91-8800197778</p>
                </div>
              </div>
            </div>
          </div>

          {/* Founder */}
          <div className="mb-8">
            <h3 className="text-2xl font-bold text-white mb-4 flex items-center">
              <span className="text-3xl mr-3">👨‍💼</span>
              Founder & Director
            </h3>
            <div className="bg-[#262421] rounded-lg p-6 border border-[#e8a93e]/30">
              <h4 className="text-xl font-bold text-white mb-2">Arun Babu Nalamara</h4>
              <p className="text-[#bababa] mb-3">
                Seismic Interpreter and development geophysicist with extensive ML and Python expertise.
              </p>
              <p className="text-[#bababa] mb-4">
                With a strong background in geoscience and cutting-edge technology, Arun brings
                a unique perspective to educational technology, combining analytical thinking with
                innovative approaches to make learning more effective and engaging for children.
              </p>
            </div>
          </div>

          {/* Innovation Beyond Geoscience */}
          <div className="mb-8">
            <h3 className="text-2xl font-bold text-white mb-4 flex items-center">
              <span className="text-3xl mr-3">🚀</span>
              Innovation Beyond Geoscience: Our Founder's Portfolio
            </h3>
            <p className="text-[#bababa] mb-4">
              AMEYEM's spirit of innovation, led by our founder Arun Babu Nalamara, extends to a diverse
              portfolio of digital ventures solving unique problems in education, creative arts, and community building.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* StoryLikho */}
              <div className="bg-[#262421] rounded-lg p-4 border border-[#4e7837]">
                <div className="flex items-center mb-2">
                  <span className="bg-[#81b64c] text-white text-xs px-2 py-1 rounded-full font-semibold mr-2">Active</span>
                  <h4 className="font-bold text-[#a3d160]">StoryLikho</h4>
                </div>
                <p className="text-sm text-[#bababa] mb-2">
                  Unleash creativity with an AI-powered platform for crafting novels and stories
                  using advanced semantic models.
                </p>
                <a href="https://storylikho.com" target="_blank" rel="noopener noreferrer"
                   className="text-[#81b64c] hover:text-[#a3d160] text-sm font-medium">
                  storylikho.com →
                </a>
              </div>

              {/* Chess99 */}
              <div className="bg-[#262421] rounded-lg p-4 border border-[#81b64c]">
                <div className="flex items-center mb-2">
                  <span className="bg-[#e8a93e] text-white text-xs px-2 py-1 rounded-full font-semibold mr-2">Coming Soon</span>
                  <h4 className="font-bold text-[#81b64c]">Chess99</h4>
                </div>
                <p className="text-sm text-[#bababa] mb-2">
                  A freemium browser-based chess platform with premium analytics for enthusiasts
                  to play, learn, and compete.
                </p>
                <span className="text-[#81b64c] text-sm font-medium">chess99.com (You are here!)</span>
              </div>

              {/* Sambandhalu */}
              <div className="bg-[#262421] rounded-lg p-4 border border-[#3d3a37]">
                <div className="flex items-center mb-2">
                  <span className="bg-[#4a4744] text-white text-xs px-2 py-1 rounded-full font-semibold mr-2">Alpha</span>
                  <h4 className="font-bold text-[#e8a93e]">Sambandhalu</h4>
                </div>
                <p className="text-sm text-[#bababa] mb-2">
                  A matrimonial and family networking platform designed to foster meaningful
                  connections in communities.
                </p>
                <span className="text-[#e8a93e] text-sm font-medium">sambandhalu.com (Pipeline)</span>
              </div>

              {/* Chittibadi/MindKeeper */}
              <div className="bg-[#262421] rounded-lg p-4 border border-[#3d3a37]">
                <div className="flex items-center mb-2">
                  <span className="bg-[#4a4744] text-[#bababa] text-xs px-2 py-1 rounded-full font-semibold mr-2">Concept</span>
                  <h4 className="font-bold text-[#f4c66a]">Chittibadi</h4>
                </div>
                <p className="text-sm text-[#bababa] mb-2">
                  AI-powered notes keeper, task master, and personal assistant for alerts
                  and organization.
                </p>
                <span className="text-[#e8a93e] text-sm font-medium">mindkeeper.ai (Pipeline)</span>
              </div>

              {/* ScriboSync */}
              <div className="bg-[#262421] rounded-lg p-4 border border-[#3d3a37] md:col-span-2">
                <div className="flex items-center mb-2">
                  <span className="bg-[#4a4744] text-[#bababa] text-xs px-2 py-1 rounded-full font-semibold mr-2">Reserved</span>
                  <h4 className="font-bold text-[#bababa]">ScriboSync</h4>
                </div>
                <p className="text-sm text-[#bababa] mb-2">
                  Advanced SaaS platform for document versioning and collaborative editing
                  with enterprise-grade features.
                </p>
                <span className="text-[#8b8987] text-sm font-medium">scribosync.com (Reserved)</span>
              </div>
            </div>

            <div className="mt-4 text-center">
              <p className="text-sm text-[#8b8987] italic">
                Ameyem.com is the parent company and owner of chess99.com
              </p>
            </div>
          </div>

          {/* Call to Action */}
          <div className="text-center">
            <p className="text-lg text-[#bababa] mb-4">
              Join us in our mission to create the next generation of bright, logical minds!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={onClose}
                className="bg-[#81b64c] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#a3d160] transition-colors shadow"
              >
                Start Playing Chess
              </button>
              <button
                onClick={onClose}
                className="bg-[#3d3a37] text-[#bababa] px-6 py-3 rounded-lg font-semibold hover:bg-[#4a4744] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutContactModal;