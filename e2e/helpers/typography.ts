import type { Locator } from '@playwright/test';

export interface TypographyStyles {
  proseBody: string;
  paragraphColor: string;
  blockquoteBorderWidth: number;
}

export const readTypographyStyles = async (heading: Locator): Promise<TypographyStyles> =>
  heading.evaluate((element) => {
    let proseContainer = element.parentElement;
    while (
      proseContainer !== null &&
      getComputedStyle(proseContainer).getPropertyValue('--tw-prose-body').trim() === ''
    ) {
      proseContainer = proseContainer.parentElement;
    }
    if (proseContainer === null) {
      throw new Error('Markdown heading has no ancestor with the typography plugin variables.');
    }

    const paragraph = proseContainer.querySelector('p');
    const blockquote = proseContainer.querySelector('blockquote');
    if (paragraph === null || blockquote === null) {
      throw new Error('Markdown prose container is missing its paragraph or blockquote.');
    }

    return {
      proseBody: getComputedStyle(proseContainer).getPropertyValue('--tw-prose-body').trim(),
      paragraphColor: getComputedStyle(paragraph).color,
      blockquoteBorderWidth: Number.parseFloat(getComputedStyle(blockquote).borderLeftWidth),
    };
  });
