package com.smintons.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "SmintonsPhotoSaver")
public class SmintonsPhotoSaverPlugin extends Plugin {
    @PluginMethod
    public void savePng(PluginCall call) {
        String base64Data = call.getString("base64Data");
        String requestedFileName = call.getString("fileName", "smintons_tournament_sticker.png");

        if (base64Data == null || base64Data.length() == 0) {
            call.reject("Image data is empty.");
            return;
        }

        String fileName = sanitizeFileName(requestedFileName);
        if (!fileName.toLowerCase().endsWith(".png")) {
            fileName = fileName + ".png";
        }

        try {
            byte[] imageBytes = Base64.decode(base64Data, Base64.DEFAULT);
            Uri savedUri;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                savedUri = saveWithMediaStore(imageBytes, fileName);
            } else {
                savedUri = saveLegacy(imageBytes, fileName);
            }

            JSObject result = new JSObject();
            result.put("uri", savedUri.toString());
            result.put("fileName", fileName);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to save image.", e);
        }
    }

    private Uri saveWithMediaStore(byte[] imageBytes, String fileName) throws Exception {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
        values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
        values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/SmintonS");
        values.put(MediaStore.Images.Media.IS_PENDING, 1);

        Uri collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
        Uri itemUri = resolver.insert(collection, values);
        if (itemUri == null) {
            throw new IllegalStateException("Could not create media store item.");
        }

        try (OutputStream outputStream = resolver.openOutputStream(itemUri)) {
            if (outputStream == null) {
                throw new IllegalStateException("Could not open media store output stream.");
            }
            outputStream.write(imageBytes);
        }

        values.clear();
        values.put(MediaStore.Images.Media.IS_PENDING, 0);
        resolver.update(itemUri, values, null, null);
        return itemUri;
    }

    private Uri saveLegacy(byte[] imageBytes, String fileName) throws Exception {
        File picturesDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES);
        File smintonsDir = new File(picturesDir, "SmintonS");
        if (!smintonsDir.exists() && !smintonsDir.mkdirs()) {
            throw new IllegalStateException("Could not create SmintonS pictures folder.");
        }

        File targetFile = getUniqueFile(smintonsDir, fileName);
        try (FileOutputStream outputStream = new FileOutputStream(targetFile)) {
            outputStream.write(imageBytes);
        }

        MediaScannerConnection.scanFile(
            getContext(),
            new String[] { targetFile.getAbsolutePath() },
            new String[] { "image/png" },
            null
        );

        return Uri.fromFile(targetFile);
    }

    private File getUniqueFile(File directory, String fileName) {
        File targetFile = new File(directory, fileName);
        if (!targetFile.exists()) {
            return targetFile;
        }

        String baseName = fileName;
        String extension = "";
        int dotIndex = fileName.lastIndexOf(".");
        if (dotIndex > 0) {
            baseName = fileName.substring(0, dotIndex);
            extension = fileName.substring(dotIndex);
        }

        int counter = 1;
        while (targetFile.exists()) {
            targetFile = new File(directory, baseName + "_" + counter + extension);
            counter += 1;
        }
        return targetFile;
    }

    private String sanitizeFileName(String fileName) {
        return fileName
            .replaceAll("[\\\\/:*?\"<>|]", "_")
            .replaceAll("\\s+", "_")
            .trim();
    }
}
