import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { getLessonsList, getLessonContent, type Lesson } from '../services/api';
import 'highlight.js/styles/github-dark.css';
import './DocsPage.css';

function DocsPage() {
  const { lessonId } = useParams<{ lessonId?: string }>();
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<string | null>(lessonId || null);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load lessons list on mount
  useEffect(() => {
    const loadLessons = async () => {
      try {
        const lessonsList = await getLessonsList();
        setLessons(lessonsList);

        // If no lesson is selected, select the first one
        if (!selectedLesson && lessonsList.length > 0) {
          const firstLesson = lessonsList[0].id;
          setSelectedLesson(firstLesson);
          navigate(`/docs/${firstLesson}`, { replace: true });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load lessons');
      } finally {
        setLoading(false);
      }
    };

    loadLessons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load lesson content when selected lesson changes
  useEffect(() => {
    if (selectedLesson) {
      const loadContent = async () => {
        setLoading(true);
        setError(null);
        try {
          const lesson = await getLessonContent(selectedLesson);
          setContent(lesson.content);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load lesson content');
          setContent('');
        } finally {
          setLoading(false);
        }
      };

      loadContent();
    }
  }, [selectedLesson]);

  // Update selected lesson when URL param changes
  useEffect(() => {
    if (lessonId && lessonId !== selectedLesson) {
      setSelectedLesson(lessonId);
    }
  }, [lessonId, selectedLesson]);

  const handleLessonClick = (id: string) => {
    setSelectedLesson(id);
    navigate(`/docs/${id}`);
  };

  const getLessonTitle = (id: string): string => {
    const lesson = lessons.find(l => l.id === id);
    return lesson?.title || id;
  };


  return (
    <div className="docs-container">
      <div className="docs-sidebar">
        <div className="docs-sidebar-header">
          <Link to="/" className="docs-home-link">← Back to App</Link>
          <h2 className="docs-sidebar-title">Documentation</h2>
        </div>
        <nav className="docs-nav">
          {loading && lessons.length === 0 ? (
            <div className="docs-loading">Loading lessons...</div>
          ) : error && lessons.length === 0 ? (
            <div className="docs-error">Error: {error}</div>
          ) : (
            <ul className="docs-lesson-list">
              {lessons.map((lesson) => (
                <li key={lesson.id}>
                  <button
                    className={`docs-lesson-item ${
                      selectedLesson === lesson.id ? 'active' : ''
                    }`}
                    onClick={() => handleLessonClick(lesson.id)}
                  >
                    {lesson.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>
      </div>
      <div className="docs-content">
        {loading && content === '' ? (
          <div className="docs-content-loading">Loading lesson...</div>
        ) : error && content === '' ? (
          <div className="docs-content-error">
            <h2>Error</h2>
            <p>{error}</p>
          </div>
        ) : (
          <div className="docs-markdown">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                // Render links as plain text (just the link text, no URL)
                a: ({ children }) => <span>{children}</span>,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

export default DocsPage;
