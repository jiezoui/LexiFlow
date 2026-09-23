package com.lexiflow.modules.podcast.service;

import com.lexiflow.common.exception.BusinessException;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PodcastFeedFetcherTest {

    private final PodcastFeedFetcher fetcher = new PodcastFeedFetcher();

    @Test
    void parsesPodcastRssAndNormalizesEpisodeMetadata() throws Exception {
        String rss = """
                <?xml version="1.0" encoding="UTF-8"?>
                <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
                  <channel>
                    <title>Everyday English</title>
                    <itunes:author>LexiFlow Radio</itunes:author>
                    <description><![CDATA[<p>A useful <strong>learning</strong> show.</p>]]></description>
                    <itunes:image href="https://cdn.example.com/show.jpg" />
                    <item>
                      <guid>episode-42</guid>
                      <title>Read the room</title>
                      <description><![CDATA[<p>Learn one phrase.</p>]]></description>
                      <link>https://example.com/episodes/42</link>
                      <pubDate>Sun, 20 Sep 2026 12:00:00 GMT</pubDate>
                      <itunes:duration>01:02:03</itunes:duration>
                      <enclosure url="audio/42.mp3" type="audio/mpeg" />
                    </item>
                  </channel>
                </rss>
                """;

        PodcastFeedFetcher.FeedData feed = fetcher.parse(
                "https://example.com/feed.xml",
                rss.getBytes(StandardCharsets.UTF_8),
                "etag-1",
                "Sun, 20 Sep 2026 12:01:00 GMT"
        );

        assertEquals("Everyday English", feed.title());
        assertEquals("LexiFlow Radio", feed.author());
        assertEquals("A useful learning show.", feed.description());
        assertEquals(1, feed.episodes().size());
        PodcastFeedFetcher.EpisodeData episode = feed.episodes().get(0);
        assertEquals("episode-42", episode.guid());
        assertEquals("https://example.com/audio/42.mp3", episode.audioUrl());
        assertEquals(3_723_000L, episode.durationMs());
        assertEquals("Learn one phrase.", episode.description());
        assertTrue(episode.publishedAt() != null);
    }

    @Test
    void blocksPrivateAndLoopbackFeedTargets() {
        assertThrows(BusinessException.class, () -> fetcher.validatePublicHttpUrl("http://127.0.0.1/feed.xml"));
        assertThrows(BusinessException.class, () -> fetcher.validatePublicHttpUrl("http://localhost/feed.xml"));
    }

    @Test
    void rejectsXmlWithDoctypeDeclarations() {
        String xml = """
                <!DOCTYPE rss [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
                <rss><channel><title>&xxe;</title></channel></rss>
                """;

        assertThrows(Exception.class, () -> fetcher.parse(
                "https://example.com/feed.xml",
                xml.getBytes(StandardCharsets.UTF_8),
                null,
                null
        ));
    }
}
