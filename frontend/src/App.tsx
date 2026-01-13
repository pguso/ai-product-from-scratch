import { BrowserRouter, Routes, Route } from 'react-router-dom';
import EditorView from './components/EditorView';
import LogsPage from './components/LogsPage';
import DocsPage from './components/DocsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<EditorView />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/logs/:sessionId" element={<LogsPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/docs/:lessonId" element={<DocsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
