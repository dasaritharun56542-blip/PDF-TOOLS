import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { TOOLS, CATEGORIES } from '../utils/tools';

export default function Home() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    if (window.AOS) {
      window.AOS.init({
        duration: 800,
        once: true,
        mirror: false
      });
    }
  }, []);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleCategoryClick = (categoryKey) => {
    setActiveCategory(categoryKey);
  };

  const filteredTools = Object.entries(TOOLS).filter(([slug, tool]) => {
    const nameMatches = tool.name.toLowerCase().includes(searchTerm.toLowerCase().trim());
    const descMatches = tool.desc.toLowerCase().includes(searchTerm.toLowerCase().trim());
    const matchesSearch = nameMatches || descMatches;
    const matchesCategory = activeCategory === 'all' || tool.cat === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .tool-card {
            display: flex !important;
            flex-direction: column !important;
            height: 100% !important;
            background: #ffffff !important;
            border-radius: 14px !important;
            padding: 1.6rem !important;
            border: 1px solid #e2e8f0 !important;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04) !important;
            text-decoration: none !important;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
            position: relative !important;
            overflow: hidden !important;
            color: inherit !important;
        }

        .tool-card:hover {
            transform: translateY(-5px) !important;
            box-shadow: 0 16px 24px -4px rgba(79, 70, 229, 0.14), 0 6px 8px -2px rgba(0, 0, 0, 0.02) !important;
            border-color: #c7d2fe !important;
        }

        .tool-icon {
            width: 50px !important;
            height: 50px !important;
            border-radius: 12px !important;
            background: rgba(79, 70, 229, 0.08) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 1.4rem !important;
            color: #4f46e5 !important;
            transition: all 0.25s ease !important;
            margin-bottom: 0 !important;
        }

        .tool-card:hover .tool-icon {
            background: #4f46e5 !important;
            color: #ffffff !important;
            transform: scale(1.06) !important;
            box-shadow: 0 6px 14px rgba(79, 70, 229, 0.25) !important;
        }

        .tool-title {
            font-size: 1.12rem !important;
            font-weight: 700 !important;
            color: #0f172a !important;
            margin-bottom: 0.45rem !important;
            line-height: 1.3 !important;
            transition: color 0.2s ease !important;
            text-decoration: none !important;
        }

        .tool-card:hover .tool-title {
            color: #4f46e5 !important;
        }

        .tool-desc {
            font-size: 0.875rem !important;
            color: #64748b !important;
            line-height: 1.5 !important;
            margin-bottom: 0 !important;
            text-decoration: none !important;
        }

        a.tool-card, a.tool-card:hover, a.tool-card:focus, a.tool-card * {
            text-decoration: none !important;
        }

        .category-btn {
            border-radius: 9999px !important;
            padding: 0.45rem 1.25rem !important;
            font-weight: 600 !important;
            font-size: 0.85rem !important;
            background-color: #ffffff !important;
            color: #475569 !important;
            border: 1px solid #cbd5e1 !important;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04) !important;
            transition: all 0.2s ease !important;
            width: auto !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
        }

        .category-btn:hover {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
            border-color: #94a3b8 !important;
            transform: translateY(-1px) !important;
        }

        .category-btn.active {
            background: #4f46e5 !important;
            color: #ffffff !important;
            border-color: #4f46e5 !important;
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3) !important;
        }
      `}} />

      <section className="hero-section text-center py-5">
        <div className="container">
          <h1 className="display-4 fw-bold mb-3" data-aos="fade-down">
            PDF Powerhouse Tools
          </h1>
          <p className="lead text-muted mb-5" data-aos="fade-up" data-aos-delay="100">
            Simple, secure, and powerful PDF processing for everyone.
          </p>

          <div className="search-container mb-5" data-aos="fade-up" data-aos-delay="200">
            <div className="search-wrapper position-relative max-width-600 mx-auto" style={{ maxWidth: '600px' }}>
              <i className="bi bi-search search-icon position-absolute"></i>
              <input
                type="text"
                id="toolSearch"
                className="form-control"
                placeholder="Search for a tool (e.g., merge, split, encrypt)..."
                value={searchTerm}
                onChange={handleSearchChange}
              />
            </div>
            <style dangerouslySetInnerHTML={{__html: `
              .search-wrapper .search-icon {
                  position: absolute !important;
                  left: 18px !important;
                  top: 50% !important;
                  transform: translateY(-50%) !important;
                  color: #9ca3af !important;
                  font-size: 1.1rem !important;
                  z-index: 10 !important;
              }
              .search-wrapper input {
                  padding-left: 48px !important;
                  border-radius: 9999px !important;
                  height: 52px !important;
                  font-size: 1.05rem !important;
                  border: 1px solid #d1d5db !important;
                  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05) !important;
              }
              .search-wrapper input:focus {
                  border-color: #4f46e5 !important;
                  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1) !important;
              }
            `}} />
          </div>

          <div className="category-strip d-flex flex-wrap justify-content-center gap-2 mb-5" data-aos="fade-up" data-aos-delay="300">
            {Object.entries(CATEGORIES).map(([key, label]) => (
              <button
                key={key}
                className={`category-btn ${activeCategory === key ? 'active' : ''}`}
                onClick={() => handleCategoryClick(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="container mb-5">
        {filteredTools.length > 0 ? (
          <div className="row g-4" id="toolsContainer">
            {filteredTools.map(([slug, tool]) => (
              <div key={slug} className="col-md-6 col-lg-4 tool-item">
                <Link to={`/tool/${slug}`} className="tool-card">
                  <div className="d-flex justify-content-between align-items-start mb-4">
                    <div className="tool-icon">
                      <i className={`bi ${tool.icon}`}></i>
                    </div>
                    <div className="d-flex gap-2">
                      {tool.premium && <span className="badge bg-warning text-dark">PRO</span>}
                      <span className="badge bg-light text-muted border">{tool.cat.toUpperCase()}</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="tool-title">{tool.name}</h3>
                    <p className="tool-desc">{tool.desc}</p>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div id="noResults" className="text-center py-5">
            <i className="bi bi-search text-muted display-1"></i>
            <h3 className="mt-3">No tools found</h3>
            <p className="text-muted">Try using different keywords or categories.</p>
          </div>
        )}
      </div>
    </>
  );
}
