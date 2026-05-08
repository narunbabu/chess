import { markdownLiteToHtml } from './markdownLite';

const markdownFieldToHtml = (block, field) => {
  if (!block[field]) return '';
  return markdownLiteToHtml(block[field]);
};

function adaptBlock(block) {
  switch (block.type) {
    case 'prose':
      return {
        ...block,
        type: 'prose',
        html: markdownFieldToHtml(block, 'body_md'),
      };

    case 'board_diagram':
      return {
        ...block,
        type: 'board_diagram',
        caption: block.caption || block.caption_md || '',
      };

    case 'board_animation':
      return {
        ...block,
        type: 'board_animation',
        caption: block.caption || block.caption_md || '',
      };

    case 'guided_move':
      return {
        ...block,
        type: 'guided_move',
        promptHtml: markdownFieldToHtml(block, 'prompt_md'),
        caption: block.caption || block.caption_md || '',
      };

    case 'mistake_refutation':
      return {
        ...block,
        type: 'mistake_refutation',
        html: markdownFieldToHtml(block, 'body_md'),
        caption: block.caption || block.caption_md || '',
      };

    case 'quiz':
      return {
        ...block,
        type: 'quiz',
        questionHtml: markdownFieldToHtml(block, 'question_md'),
      };

    default:
      return block;
  }
}

export function adaptV2Chapter(bookManifest, chapter) {
  const adaptedSections = (chapter.sections || []).map((section) => ({
    ...section,
    blocks: (section.blocks || []).map(adaptBlock),
  }));

  const checkpointBlocks = chapter.checkpoint?.blocks || [];

  return {
    ...chapter,
    id: chapter.chapterId || chapter.id,
    bookId: bookManifest.bookId,
    bookTitle: bookManifest.title,
    bookSubtitle: bookManifest.subtitle,
    purpose: bookManifest.purpose,
    audience: bookManifest.audience,
    howToRead: bookManifest.howToRead,
    isV2: true,
    sections: adaptedSections,
    checkpoint: chapter.checkpoint
      ? {
        ...chapter.checkpoint,
        summaryHtml: chapter.checkpoint.summary_md ? markdownLiteToHtml(chapter.checkpoint.summary_md) : '',
        blocks: checkpointBlocks.map(adaptBlock),
      }
      : null,
  };
}

