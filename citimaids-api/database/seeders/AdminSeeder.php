<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::firstOrCreate(
            ['email' => 'admin@citimaids.com'],
            [
                'name'     => 'Admin',
                'password' => Hash::make('Citimaids@admin!$123'),
                'role'     => 'admin',
            ]
        );

        // Force-update the password in case the record already existed with a plain-text password
        if (!password_get_info($admin->password)['algoName'] || $admin->password === 'Citimaids@admin!$123') {
            $admin->password = Hash::make('Citimaids@admin!$123');
            $admin->save();
        }
    }
}
