package com.example.data

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "situation_table")
data class SituationEntity(
    @PrimaryKey val id: String = "current",
    val jsonString: String,
    val updatedAt: Long = System.currentTimeMillis()
)

@Dao
interface SituationDao {
    @Query("SELECT * FROM situation_table WHERE id = 'current'")
    fun getSituationFlow(): Flow<SituationEntity?>

    @Query("SELECT * FROM situation_table WHERE id = 'current'")
    suspend fun getSituationSync(): SituationEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSituation(entity: SituationEntity)
}

@Entity(tableName = "vault_table")
data class VaultEntity(
    @PrimaryKey val key: String,
    val value: String, // JSON blob
    val cachedAt: Long = System.currentTimeMillis()
)

@Dao
interface VaultDao {
    @Query("SELECT * FROM vault_table WHERE key = :key")
    suspend fun getVaultEntry(key: String): VaultEntity?

    @Query("SELECT * FROM vault_table")
    fun getAllVaultEntriesFlow(): Flow<List<VaultEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertVaultEntry(entry: VaultEntity)
}

@Entity(tableName = "identity_table")
data class IdentityEntity(
    @PrimaryKey val field: String, // "passport", "emergency_contact", "blood_type", "name", etc.
    val encryptedValue: String
)

@Dao
interface IdentityDao {
    @Query("SELECT * FROM identity_table")
    fun getAllIdentityEntriesFlow(): Flow<List<IdentityEntity>>

    @Query("SELECT * FROM identity_table WHERE field = :field")
    suspend fun getIdentityEntry(field: String): IdentityEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertIdentityEntry(entry: IdentityEntity)
}

@Database(
    entities = [SituationEntity::class, VaultEntity::class, IdentityEntity::class],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun situationDao(): SituationDao
    abstract fun vaultDao(): VaultDao
    abstract fun identityDao(): IdentityDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "aegis_database"
                )
                .fallbackToDestructiveMigration()
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
