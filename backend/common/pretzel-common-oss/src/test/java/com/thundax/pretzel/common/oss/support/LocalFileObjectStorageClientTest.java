package com.thundax.pretzel.common.oss.support;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.thundax.pretzel.common.oss.model.ObjectStorageWriteResult;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import org.apache.commons.io.IOUtils;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

public class LocalFileObjectStorageClientTest {

    @TempDir
    private Path temporaryFolder;

    @Test
    public void shouldWriteReadAndDeleteLocalObject() throws Exception {
        LocalFileObjectStorageClient client = new LocalFileObjectStorageClient(temporaryFolder.toString(), "file:");

        ObjectStorageWriteResult result =
                client.put("avatars/user.txt", new ByteArrayInputStream("hello".getBytes(StandardCharsets.UTF_8)));

        assertEquals("avatars/user.txt", result.getKey());
        assertEquals("file:avatars/user.txt", result.getLocation());
        assertEquals(5L, result.getSize());
        assertTrue(client.exists("avatars/user.txt"));
        assertEquals("hello", IOUtils.toString(client.get("avatars/user.txt"), StandardCharsets.UTF_8));

        client.delete("avatars/user.txt");

        assertFalse(client.exists("avatars/user.txt"));
    }

    @Test
    public void failedUploadMustPreserveExistingContentAndRemoveTemporaryFile() throws Exception {
        LocalFileObjectStorageClient client = new LocalFileObjectStorageClient(temporaryFolder.toString(), "file:");
        client.put("original.txt", new ByteArrayInputStream("original".getBytes(StandardCharsets.UTF_8)));
        java.io.InputStream broken = new java.io.InputStream() {
            @Override
            public int read() throws java.io.IOException {
                throw new java.io.IOException("broken input");
            }
        };
        assertThrows(java.io.IOException.class, () -> client.put("original.txt", broken));
        try (var input = client.get("original.txt")) {
            assertEquals("original", IOUtils.toString(input, StandardCharsets.UTF_8));
        }
        try (var files = java.nio.file.Files.list(temporaryFolder)) {
            assertEquals(1L, files.count());
        }
    }

    @Test
    public void shouldRejectEscapedKey() throws Exception {
        LocalFileObjectStorageClient client = new LocalFileObjectStorageClient(temporaryFolder.toString(), "file:");

        assertThrows(
                IllegalArgumentException.class,
                () -> client.put("../outside.txt", new ByteArrayInputStream("bad".getBytes(StandardCharsets.UTF_8))));
    }
}
