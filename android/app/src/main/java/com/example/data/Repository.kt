package com.example.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

object CryptoHelper {
    private const val KEY_ALIAS = "aegis_key_alias"
    private const val ANDROID_KEYSTORE = "AndroidKeyStore"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"

    init {
        try {
            val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
            if (!keyStore.containsAlias(KEY_ALIAS)) {
                val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
                keyGenerator.init(
                    KeyGenParameterSpec.Builder(
                        KEY_ALIAS,
                        KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
                    )
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .build()
                )
                keyGenerator.generateKey()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun getSecretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        return keyStore.getKey(KEY_ALIAS, null) as SecretKey
    }

    fun encrypt(plainText: String): String {
        if (plainText.isEmpty()) return ""
        return try {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, getSecretKey())
            val iv = cipher.iv
            val encryptedBytes = cipher.doFinal(plainText.toByteArray(Charsets.UTF_8))
            val combined = ByteArray(iv.size + encryptedBytes.size)
            System.arraycopy(iv, 0, combined, 0, iv.size)
            System.arraycopy(encryptedBytes, 0, combined, iv.size, encryptedBytes.size)
            Base64.encodeToString(combined, Base64.NO_WRAP)
        } catch (e: Exception) {
            e.printStackTrace()
            ""
        }
    }

    fun decrypt(encryptedText: String): String {
        if (encryptedText.isEmpty()) return ""
        return try {
            val combined = Base64.decode(encryptedText, Base64.NO_WRAP)
            val ivSize = 12
            val iv = ByteArray(ivSize)
            val encryptedBytes = ByteArray(combined.size - ivSize)
            System.arraycopy(combined, 0, iv, 0, ivSize)
            System.arraycopy(combined, ivSize, encryptedBytes, 0, encryptedBytes.size)

            val cipher = Cipher.getInstance(TRANSFORMATION)
            val spec = GCMParameterSpec(128, iv)
            cipher.init(Cipher.DECRYPT_MODE, getSecretKey(), spec)
            val decryptedBytes = cipher.doFinal(encryptedBytes)
            String(decryptedBytes, Charsets.UTF_8)
        } catch (e: Exception) {
            e.printStackTrace()
            ""
        }
    }
}

class AegisRepository(context: Context) {
    private val database = AppDatabase.getDatabase(context)
    private val situationDao = database.situationDao()
    private val vaultDao = database.vaultDao()
    private val identityDao = database.identityDao()

    private val moshi = Moshi.Builder()
        .add(KotlinJsonAdapterFactory())
        .build()

    private val situationAdapter = moshi.adapter(SituationObject::class.java)

    val situationFlow: Flow<SituationObject?> = situationDao.getSituationFlow().map { entity ->
        entity?.let {
            try {
                situationAdapter.fromJson(it.jsonString)
            } catch (e: Exception) {
                e.printStackTrace()
                null
            }
        }
    }

    suspend fun getSituationSync(): SituationObject? {
        val entity = situationDao.getSituationSync()
        return entity?.let {
            try {
                situationAdapter.fromJson(it.jsonString)
            } catch (e: Exception) {
                null
            }
        }
    }

    suspend fun saveSituation(situation: SituationObject) {
        try {
            val json = situationAdapter.toJson(situation)
            situationDao.insertSituation(SituationEntity(jsonString = json))
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    suspend fun saveVaultEntry(key: String, valueJson: String) {
        vaultDao.insertVaultEntry(VaultEntity(key = key, value = valueJson))
    }

    suspend fun getVaultEntry(key: String): String? {
        return vaultDao.getVaultEntry(key)?.value
    }

    suspend fun saveIdentityField(field: String, plainValue: String) {
        val encrypted = CryptoHelper.encrypt(plainValue)
        identityDao.insertIdentityEntry(IdentityEntity(field = field, encryptedValue = encrypted))
    }

    suspend fun getIdentityField(field: String): String {
        val entity = identityDao.getIdentityEntry(field) ?: return ""
        return CryptoHelper.decrypt(entity.encryptedValue)
    }

    fun getIdentityFlow(): Flow<Map<String, String>> {
        return identityDao.getAllIdentityEntriesFlow().map { list ->
            list.associate { entity ->
                entity.field to CryptoHelper.decrypt(entity.encryptedValue)
            }
        }
    }
}
