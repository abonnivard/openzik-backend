import stringSimilarity from 'string-similarity';

describe('Search Utilities', () => {
  describe('String similarity', () => {
    test('should calculate similarity between identical strings', () => {
      const str1 = 'The Beatles - Hey Jude';
      const str2 = 'The Beatles - Hey Jude';
      
      const similarity = stringSimilarity.compareTwoStrings(str1, str2);
      expect(similarity).toBe(1);
    });

    test('should calculate similarity between similar strings', () => {
      const str1 = 'The Beatles - Hey Jude';
      const str2 = 'Beatles - Hey Jude';
      
      const similarity = stringSimilarity.compareTwoStrings(str1, str2);
      expect(similarity).toBeGreaterThan(0.8);
      expect(similarity).toBeLessThan(1);
    });

    test('should calculate low similarity for different strings', () => {
      const str1 = 'The Beatles - Hey Jude';
      const str2 = 'Led Zeppelin - Stairway to Heaven';
      
      const similarity = stringSimilarity.compareTwoStrings(str1, str2);
      expect(similarity).toBeLessThan(0.3);
    });

    test('should find best match from array', () => {
      const target = 'The Beatles - Hey Jude';
      const candidates = [
        'Beatles - Hey Jude',
        'The Beatles - Yesterday',
        'Rolling Stones - Paint It Black',
        'Led Zeppelin - Stairway to Heaven'
      ];
      
      const bestMatch = stringSimilarity.findBestMatch(target, candidates);
      expect(bestMatch.bestMatch.target).toBe('Beatles - Hey Jude');
      expect(bestMatch.bestMatch.rating).toBeGreaterThan(0.8);
    });
  });

  describe('Search text processing', () => {
    test('should normalize search text', () => {
      const normalizeSearchText = (text) => {
        return text
          .toLowerCase()
          .trim()
          .replace(/[^\w\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      };

      expect(normalizeSearchText('  The Beatles - Hey Jude!  ')).toBe('the beatles hey jude');
      expect(normalizeSearchText('AC/DC - Back in Black')).toBe('ac dc back in black');
      expect(normalizeSearchText('Guns N\' Roses')).toBe('guns n roses');
    });

    test('should extract search terms', () => {
      const extractSearchTerms = (text) => {
        return text
          .toLowerCase()
          .trim()
          .replace(/[^\w\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .split(' ')
          .filter(term => term.length > 2);
      };

      expect(extractSearchTerms('The Beatles - Hey Jude')).toEqual(['the', 'beatles', 'hey', 'jude']);
      expect(extractSearchTerms('AC/DC - Back in Black')).toEqual(['back', 'black']);
      expect(extractSearchTerms('a b cd efg')).toEqual(['efg']);
    });
  });

  describe('Music metadata parsing', () => {
    test('should parse track title from filename', () => {
      const parseTrackFromFilename = (filename) => {
        // Remove file extension
        let name = filename.replace(/\.[^/.]+$/, '');
        
        // Try to split artist - title
        const parts = name.split(' - ');
        if (parts.length >= 2) {
          return {
            artist: parts[0].trim(),
            title: parts.slice(1).join(' - ').trim()
          };
        }
        
        return {
          artist: '',
          title: name.trim()
        };
      };

      expect(parseTrackFromFilename('The Beatles - Hey Jude.mp3')).toEqual({
        artist: 'The Beatles',
        title: 'Hey Jude'
      });

      expect(parseTrackFromFilename('Led Zeppelin - Stairway to Heaven - Remastered.flac')).toEqual({
        artist: 'Led Zeppelin',
        title: 'Stairway to Heaven - Remastered'
      });

      expect(parseTrackFromFilename('Unknown Song.mp3')).toEqual({
        artist: '',
        title: 'Unknown Song'
      });
    });
  });
});
