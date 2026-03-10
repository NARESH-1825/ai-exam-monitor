// backend/controllers/importController.js
// Handles multipart file upload, delegates to questionParser, returns preview questions.
// Does NOT save to DB — saving is done by the existing createPaper / updatePaper endpoints.

const { parseFile } = require('../utils/questionParser');

exports.importQuestionPaper = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded. Please attach a file.' });
    }

    const { buffer, mimetype, originalname } = req.file;

    let questions;
    try {
      questions = await parseFile(buffer, mimetype, originalname);
    } catch (parseErr) {
      // Parse-level errors (scanned PDF, corrupt file, etc.)
      return res.status(422).json({ message: parseErr.message });
    }

    if (!questions || questions.length === 0) {
      const ext = (originalname || '').split('.').pop().toLowerCase();
      let hint = '';
      if (ext === 'pdf') {
        hint =
          ' For PDF files, questions must start with "Q1." or "1." and options with "A." – "D.", ' +
          'each on its own line, followed by "Answer: B" and "Marks: 2". ' +
          'Scanned/image PDFs are not supported — use a text-based PDF or export to DOCX/CSV.';
      } else if (ext === 'docx' || ext === 'doc') {
        hint = ' For DOCX files, follow the same Q1./A./B. format as PDF.';
      } else if (ext === 'xlsx' || ext === 'xls') {
        hint = ' For Excel, ensure row 1 has headers: Question | A | B | C | D | Answer | Marks.';
      } else if (ext === 'csv') {
        hint = ' For CSV, ensure the first row has headers: question,A,B,C,D,answer,marks.';
      }
      return res.status(422).json({
        message: 'No questions could be extracted from the file.' + hint,
      });
    }

    res.json({
      questions,
      count: questions.length,
      filename: originalname,
    });
  } catch (err) {
    console.error('[importController] Unexpected error:', err);
    res.status(500).json({ message: err.message || 'Import failed' });
  }
};
