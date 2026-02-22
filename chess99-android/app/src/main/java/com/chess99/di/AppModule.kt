package com.chess99.di

import android.content.Context
import com.chess99.data.repository.AuthRepositoryImpl
import com.chess99.domain.repository.AuthRepository
import com.chess99.engine.StockfishEngine
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
        @Provides
        @Singleton
        fun provideStockfishEngine(): StockfishEngine = StockfishEngine()

        @Provides
        @Singleton
        fun provideSoundManager(@ApplicationContext context: Context): SoundManager = SoundManager(context)
    }
}
