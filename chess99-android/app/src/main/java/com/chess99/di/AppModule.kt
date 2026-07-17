package com.chess99.di

import android.content.Context
import com.chess99.data.repository.AuthRepositoryImpl
import com.chess99.domain.repository.AuthRepository
import com.chess99.presentation.common.SoundManager
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class AppModule {

    @Binds
    @Singleton
    abstract fun bindAuthRepository(impl: AuthRepositoryImpl): AuthRepository

    companion object {
        // StockfishEngine (S2) has an @Inject constructor and is provided by Hilt
        // automatically — no manual @Provides needed (it now takes an
        // @ApplicationContext Context to locate the native engine binary).

        @Provides
        @Singleton
        fun provideSoundManager(@ApplicationContext context: Context): SoundManager = SoundManager(context)
    }
}
